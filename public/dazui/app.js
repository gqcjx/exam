// 啄木鸟 · 字词学习版
// 玩法：点击字词 -> 啄木鸟飞向该词 -> 吞食后判断
// 正确：加分、体型增大；错误：扣分、体型减小；错误占比约 5%

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

// ========== Supabase 集成 ==========
let supabaseClient = null;
let currentUserId = null;
let gameStartTime = null; // 游戏开始时间

// 从 localStorage 获取 token 并初始化 Supabase（方案C：网络要求最少）
async function initSupabase() {
	try {
		// 从 localStorage 获取认证信息（本地操作，无网络请求）
		const token = localStorage.getItem('supabase_auth_token');
		const supabaseUrl = localStorage.getItem('supabase_url');
		const supabaseKey = localStorage.getItem('supabase_anon_key');

		if (!token || !supabaseUrl || !supabaseKey) {
			console.log('未提供认证信息，游戏将以离线模式运行');
			return;
		}

		// 动态导入 Supabase 客户端（这可能需要网络请求，但可以在构建时静态包含）
		const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
		supabaseClient = createClient(supabaseUrl, supabaseKey, {
			global: {
				headers: {
					Authorization: `Bearer ${token}`
				}
			}
		});

		// 跳过 token 验证（延迟验证策略：在保存分数时自然验证）
		// 这样可以减少 1 次网络请求，提高启动速度
		// 如果 token 失效，保存分数时会失败，但不影响游戏运行
		// 从 token 中提取 user_id（JWT token 包含用户信息）
		try {
			const tokenParts = token.split('.');
			if (tokenParts.length === 3) {
				const payload = JSON.parse(atob(tokenParts[1]));
				currentUserId = payload.sub; // JWT sub 字段是 user_id
				console.log('✅ 已登录，积分将自动保存（延迟验证模式）');
			} else {
				console.warn('Token 格式不正确，游戏将以离线模式运行');
				supabaseClient = null;
			}
		} catch (parseError) {
			console.warn('无法从 token 中提取用户信息，游戏将以离线模式运行', parseError);
			supabaseClient = null;
		}
	} catch (error) {
		console.warn('Supabase 初始化失败，游戏将以离线模式运行', error);
		supabaseClient = null;
	}
}

// 保存游戏积分
async function saveGameScore() {
	if (!supabaseClient || !currentUserId || !gameStartTime) {
		return;
	}

	const playDuration = Math.floor((Date.now() - gameStartTime) / 1000);

	const gameData = {
		user_id: currentUserId,
		game_name: 'dazui',
		score: STATE.score,
		level: STATE.level,
		correct_count: STATE.correct,
		wrong_count: STATE.wrong,
		play_duration: playDuration,
		best_score: STATE.score // 初始值，后续会更新
	};

	try {
		// 先查询是否已有记录
		const { data: existing } = await supabaseClient
			.from('game_scores')
			.select('id, best_score')
			.eq('user_id', currentUserId)
			.eq('game_name', 'dazui')
			.single();

		// 如果当前分数更高，更新 best_score
		if (existing && STATE.score > (existing.best_score || 0)) {
			gameData.best_score = STATE.score;
		} else if (existing) {
			gameData.best_score = existing.best_score;
		}

		// 使用 upsert，如果已存在则更新，不存在则插入
		const { data, error } = await supabaseClient
			.from('game_scores')
			.upsert(gameData, {
				onConflict: 'user_id,game_name',
				ignoreDuplicates: false
			})
			.select()
			.single();

		if (error) throw error;

		console.log('✅ 游戏积分已保存', data);
		showToast('✅ 积分已保存！', '#16a34a');
	} catch (error) {
		console.error('❌ 保存积分失败', error);
		showToast('⚠️ 积分保存失败，请检查网络', '#dc2626');
	}
}

// 退出游戏
async function exitGame() {
	if (STATE.running && gameStartTime) {
		// 如果游戏正在运行，先保存积分
		await saveGameScore();
	}

	// 从 localStorage 读取返回 URL（方案C）
	const returnUrl = localStorage.getItem('game_return_url') || '/dashboard';

	// 清理 localStorage 中的认证信息（可选，为了安全）
	// localStorage.removeItem('supabase_auth_token');
	// localStorage.removeItem('supabase_url');
	// localStorage.removeItem('supabase_anon_key');
	// localStorage.removeItem('game_return_url');

	// 如果是从主应用跳转过来的，返回主应用
	if (window.parent !== window) {
		// 在 iframe 中
		window.parent.postMessage({ type: 'game-exit' }, '*');
	} else {
		// 直接跳转
		window.location.href = returnUrl;
	}
}

// 页面加载时初始化 Supabase
initSupabase();

// UI
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const speedEl = document.getElementById('speed');
const correctEl = document.getElementById('correct');
const wrongEl = document.getElementById('wrong');
const progressEl = document.getElementById('progress');
const wrongRateEl = document.getElementById('wrongRate');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const exitBtn = document.getElementById('exitBtn');
const overlay = document.getElementById('overlay');
const overlayStart = document.getElementById('overlayStart');
const overlayTitle = document.getElementById('overlayTitle');
const overlayTip = document.getElementById('overlayTip');
const toast = document.getElementById('toast');
const bgMusic = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicBtn');

// 音乐状态
let musicEnabled = true;

// 低配模式与帧率控制
let lowPowerMode = false;
let lastFrameAt = 0;
const TARGET_FPS_LOW = 30;
const TARGET_FPS_NORMAL = 60;
let targetFPS = TARGET_FPS_NORMAL;

function shouldSkipFrame(nowTs) {
	if (nowTs - lastFrameAt < (1000 / targetFPS)) return true;
	lastFrameAt = nowTs;
	return false;
}

function autoDetectLowPower() {
	try {
		const cores = navigator.hardwareConcurrency || 2;
		const mem = navigator.deviceMemory || 4;
		const dpr = window.devicePixelRatio || 1;
		return cores <= 2 || mem <= 4 || dpr <= 1;
	} catch (e) {
		return false;
	}
}

// 性能优化：背景缓存
let bgCache = null;         // 静态层（天空、山、地）
let decorCache = null;      // 装饰层（花、草、蘑菇、动物等）
let cacheWidth = 0;
let cacheHeight = 0;

function prepareBackgroundCache() {
	if (!canvas.width || !canvas.height) return;

	cacheWidth = canvas.width;
	cacheHeight = canvas.height;

	// 1. 创建基础背景缓存（天空、山、地）
	bgCache = document.createElement('canvas');
	bgCache.width = cacheWidth;
	bgCache.height = cacheHeight;
	const bctx = bgCache.getContext('2d');

	// 天空渐变
	const skyGrad = bctx.createLinearGradient(0, 0, 0, cacheHeight - 120);
	skyGrad.addColorStop(0, '#87ceeb');
	skyGrad.addColorStop(1, '#e6f2ff');
	bctx.fillStyle = skyGrad;
	bctx.fillRect(0, 0, cacheWidth, cacheHeight - 120);

	// 远山
	bctx.fillStyle = '#a5c4f4';
	bctx.beginPath();
	bctx.moveTo(0, cacheHeight - 120);
	bctx.lineTo(160, cacheHeight - 220);
	bctx.lineTo(320, cacheHeight - 120);
	bctx.closePath();
	bctx.fill();
	bctx.beginPath();
	bctx.moveTo(280, cacheHeight - 120);
	bctx.lineTo(520, cacheHeight - 260);
	bctx.lineTo(760, cacheHeight - 120);
	bctx.closePath();
	bctx.fill();

	// 地面
	const groundGrad = bctx.createLinearGradient(0, cacheHeight - 120, 0, cacheHeight);
	groundGrad.addColorStop(0, '#90ee90');
	groundGrad.addColorStop(1, '#7cb342');
	bctx.fillStyle = groundGrad;
	bctx.fillRect(0, cacheHeight - 120, cacheWidth, 120);

	// 2. 创建装饰物缓存（草、花、蘑菇、动物等静态元素）
	decorCache = document.createElement('canvas');
	decorCache.width = cacheWidth;
	decorCache.height = cacheHeight;
	const dctx = decorCache.getContext('2d');

	// 地面装饰（小草）
	dctx.fillStyle = '#66bb6a';
	const grassN = 20;
	for (let i = 0; i < grassN; i++) {
		const x = (i * 50) % cacheWidth;
		const y = cacheHeight - 120 + Math.sin(i) * 5;
		dctx.fillRect(x, y, 2, 8);
	}

	// 使用新重构的函数绘制装饰物（已支持传入上下文）
	drawGroundDecorations(dctx);

	console.log('🖼️ 背景缓存已准备完成');
}

// 启动时自动检测是否进入低配模式，支持 URL 开关 ?low=1 / ?low=0
(() => {
	try {
		const usp = new URLSearchParams(location.search);
		if (usp.has('low')) {
			lowPowerMode = usp.get('low') === '1';
		} else {
			lowPowerMode = autoDetectLowPower();
		}

		// 根据低配模式设置目标帧率
		if (lowPowerMode) {
			targetFPS = TARGET_FPS_LOW;
			console.log('⚙️ 已启用低配模式：将降低帧率并简化特效');
		}
	} catch (e) {
		// ignore
	}
})();

// 等级：移动速度（像素/帧）、出词间隔(ms)、最大并发词数
const LEVELS = [
	{ name: '慢', birdSpeed: 4, spawnMs: 1400, maxItems: 3 },
	{ name: '稍快', birdSpeed: 5.5, spawnMs: 1200, maxItems: 4 },
	{ name: '快', birdSpeed: 7, spawnMs: 1000, maxItems: 5 }
];

const STATE = {
	running: false,
	paused: false,
	score: 0,
	level: 0, // 0级开始，最高3级
	correct: 0,
	wrong: 0,
	probWrong: 0.10,
	correctCounter: 0, // 用于追踪连续正确词数量
	levelProgress: 0 // 当前级别的进度分数
};

// 啄木鸟（圆形+三角喙的简化造型）
const bird = {
	x: 120,
	y: canvas.height - 120,
	target: null, // {x,y,index}
	size: 16, // 半径，随正确/错误变化
	color: '#e11d48',
	// 自由飞行相关
	idleMode: false, // 空闲模式
	vx: 0, // x方向速度
	vy: 0, // y方向速度
	nextIdleTarget: null, // 下一个随机目标点
	idleTimer: 0 // 空闲计时器
};

let items = []; // {x,y,text,correct,right, w,h, ttl}
let spawnTimer; let animationId;

function resetGame() {
	// 如果游戏已运行过，保存积分
	if (STATE.running && gameStartTime) {
		saveGameScore();
	}

	STATE.running = false; STATE.paused = false;
	STATE.score = 0; STATE.level = 0; STATE.correct = 0; STATE.wrong = 0; STATE.correctCounter = 0; STATE.levelProgress = 0;
	items = [];
	bird.x = 120; bird.y = canvas.height - 120; bird.size = 16; bird.target = null;
	bird.idleMode = false; bird.idleTimer = 0; bird.nextIdleTarget = null; // 重置空闲状态
	gameStartTime = null; // 重置游戏开始时间

	// 停止背景音乐
	if (bgMusic) {
		bgMusic.pause();
		bgMusic.currentTime = 0;
	}

	updateUI();
	overlay.classList.remove('hidden');
	overlayTitle.textContent = '点击开始';
	overlayTip.textContent = '点击字词，大嘴鸟飞去吞食：正确+1分，错误-1分；累计18分升1级，36分升2级，72分升3级（最高级）；3级解锁"知新"功能；每9个正确词必出1个错误词';
	draw();
}

function updateUI() {
	scoreEl.textContent = STATE.score;
	levelEl.textContent = STATE.level;
	speedEl.textContent = STATE.level > 0 ? LEVELS[Math.min(STATE.level - 1, LEVELS.length - 1)].name : '慢';
	correctEl.textContent = STATE.correct;
	wrongEl.textContent = STATE.wrong;

	// 根据级别显示不同的进度要求
	let need, cur;
	if (STATE.level === 0) {
		need = 18;
		cur = STATE.levelProgress;
	} else if (STATE.level === 1) {
		need = 36;
		cur = STATE.levelProgress;
	} else if (STATE.level === 2) {
		need = 72;
		cur = STATE.levelProgress;
	} else {
		need = 72;
		cur = 72; // 3级已满
	}
	progressEl && (progressEl.textContent = `${cur}/${need}`);
	wrongRateEl && (wrongRateEl.textContent = `${Math.round(STATE.probWrong * 100)}%`);

	// 3级时显示"知新"按钮
	const zhixinBtn = document.getElementById('zhixinBtn');
	if (zhixinBtn) {
		if (STATE.level >= 3) {
			zhixinBtn.classList.remove('hidden');
		} else {
			zhixinBtn.classList.add('hidden');
		}
	}
}

// 背景装饰元素
const clouds = [
	{ x: 150, y: 80, size: 60, speed: 0.3 },
	{ x: 450, y: 120, size: 80, speed: 0.25 },
	{ x: 750, y: 60, size: 70, speed: 0.35 },
	{ x: 200, y: 150, size: 50, speed: 0.2 },
	{ x: 600, y: 100, size: 65, speed: 0.3 }
];

// 树木数据（x位置、摆动角度、生长进度）
const trees = [
	{ x: 100, swayAngle: 0, targetSway: 0, growthStage: 0 },
	{ x: 700, swayAngle: 0, targetSway: 0, growthStage: 0 },
	{ x: 850, swayAngle: 0, targetSway: 0, growthStage: 0 }
];

let sunAngle = 0;
let lastClickX = canvas.width / 2; // 记录上次点击位置
const particles = []; // {x, y, vx, vy, life, color, size}
const floatingTexts = []; // {x, y, text, color, life, scale}
const errorPrompt = { active: false, wrongWord: '', rightWord: '', x: 0, y: 0, scale: 0, timer: 0 }; // 错误提示

function drawBackground() {
	// 如果缓存未准备好，或者画布尺寸发生变化，则重新准备
	if (!bgCache || cacheWidth !== canvas.width || cacheHeight !== canvas.height) {
		prepareBackgroundCache();
	}

	// 1. 绘制静态背景层（天空、山、地）
	ctx.drawImage(bgCache, 0, 0);

	// 2. 绘制太阳（动态）
	sunAngle += 0.01;
	const sunX = canvas.width - 120;
	const sunY = 100;
	const sunSize = 40;

	// 太阳光晕/光芒（低配模式下跳过）
	if (!lowPowerMode) {
		const pulseSize = sunSize * (1.4 + Math.sin(sunAngle * 2) * 0.1);
		ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
		ctx.beginPath();
		ctx.arc(sunX, sunY, pulseSize, 0, Math.PI * 2);
		ctx.fill();

		ctx.strokeStyle = '#ffd700';
		ctx.lineWidth = 3;
		for (let i = 0; i < 12; i++) {
			const angle = (i / 12) * Math.PI * 2 + sunAngle;
			const rayLength = sunSize + 15 + Math.sin(sunAngle * 3 + i) * 5;
			ctx.beginPath();
			ctx.moveTo(sunX + Math.cos(angle) * sunSize, sunY + Math.sin(angle) * sunSize);
			ctx.lineTo(sunX + Math.cos(angle) * rayLength, sunY + Math.sin(angle) * rayLength);
			ctx.stroke();
		}
	}

	ctx.fillStyle = '#ffd700';
	ctx.beginPath();
	ctx.arc(sunX, sunY, sunSize, 0, Math.PI * 2);
	ctx.fill();

	if (!lowPowerMode) {
		// 太阳面部
		ctx.fillStyle = '#333';
		ctx.lineWidth = 3;
		ctx.beginPath(); ctx.arc(sunX - 12, sunY - 8, 2, 0, Math.PI * 2); ctx.fill();
		ctx.beginPath(); ctx.arc(sunX - 12, sunY - 8, 8, 0.2, Math.PI - 0.2); ctx.stroke();
		ctx.beginPath(); ctx.arc(sunX + 12, sunY - 8, 2, 0, Math.PI * 2); ctx.fill();
		ctx.beginPath(); ctx.arc(sunX + 12, sunY - 8, 8, 0.2, Math.PI - 0.2); ctx.stroke();
		ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3;
		ctx.beginPath(); ctx.arc(sunX, sunY + 5, 20, 0.3, Math.PI - 0.3); ctx.stroke();
		ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
		ctx.beginPath(); ctx.arc(sunX - 25, sunY + 8, 8, 0, Math.PI * 2); ctx.fill();
		ctx.beginPath(); ctx.arc(sunX + 25, sunY + 8, 8, 0, Math.PI * 2); ctx.fill();
	}

	// 3. 绘制云朵（动态）
	const cloudCount = lowPowerMode ? Math.min(2, clouds.length) : clouds.length;
	for (let i = 0; i < cloudCount; i++) {
		const cloud = clouds[i];
		cloud.x += cloud.speed;
		if (cloud.x > canvas.width + 100) cloud.x = -100;
		drawCloud(cloud.x, cloud.y, cloud.size);
	}

	// 4. 绘制静态装饰物层（小草、动物、花、蘑菇）
	ctx.drawImage(decorCache, 0, 0);

	// 5. 更新并绘制树木（动态摆动）
	for (const tree of trees) {
		tree.swayAngle += (tree.targetSway - tree.swayAngle) * 0.1;
		tree.targetSway *= 0.95;
		tree.growthStage = STATE.level;
		drawTree(tree, canvas.height - 120);
	}
}

// 绘制草地装饰（乌龟、小兔子、蘑菇、小花等）
function drawGroundDecorations(pCtx = ctx) {
	const groundY = canvas.height - 120;

	// 乌龟（左边，向右爬行）
	drawTurtle(150, groundY, 0.8, pCtx);

	// 小兔子（右边，面向左）
	drawRabbit(canvas.width - 180, groundY - 5, 0.7, true, pCtx);

	// 蘑菇
	drawMushroom(280, groundY, '#ff6b6b', 12, pCtx);
	drawMushroom(450, groundY, '#ffeb3b', 10, pCtx);
	drawMushroom(750, groundY, '#ff6b6b', 14, pCtx);

	// 小花
	drawFlower(320, groundY - 5, '#ff69b4', 8, pCtx);
	drawFlower(520, groundY - 5, '#9c27b0', 7, pCtx);
	drawFlower(680, groundY - 5, '#ff6b6b', 9, pCtx);
	drawFlower(850, groundY - 5, '#ffa726', 8, pCtx);
}

// 绘制乌龟（向右爬行）
function drawTurtle(x, y, scale = 1, pCtx = ctx) {
	pCtx.save();
	pCtx.translate(x, y);
	pCtx.scale(scale, scale);

	// 乌龟壳（椭圆形，绿色）
	pCtx.fillStyle = '#4caf50';
	pCtx.beginPath();
	pCtx.ellipse(0, 0, 20, 15, 0, 0, Math.PI * 2);
	pCtx.fill();

	// 乌龟壳纹理（六边形图案）
	pCtx.strokeStyle = '#2e7d32';
	pCtx.lineWidth = 1.5;
	// 中央六边形
	pCtx.beginPath();
	for (let i = 0; i < 6; i++) {
		const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
		const px = Math.cos(angle) * 8;
		const py = Math.sin(angle) * 8;
		if (i === 0) pCtx.moveTo(px, py);
		else pCtx.lineTo(px, py);
	}
	pCtx.closePath();
	pCtx.stroke();

	// 周围小六边形
	const hexPositions = [
		[-12, -8], [12, -8], [-12, 8], [12, 8], [0, -12], [0, 12]
	];
	for (const [hx, hy] of hexPositions) {
		pCtx.beginPath();
		for (let i = 0; i < 6; i++) {
			const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
			const px = hx + Math.cos(angle) * 4;
			const py = hy + Math.sin(angle) * 4;
			if (i === 0) pCtx.moveTo(px, py);
			else pCtx.lineTo(px, py);
		}
		pCtx.closePath();
		pCtx.stroke();
	}

	// 乌龟脖子（向右延伸，长脖子）
	pCtx.fillStyle = '#66bb6a';
	pCtx.beginPath();
	pCtx.ellipse(18, -2, 12, 5, 0, 0, Math.PI * 2);
	pCtx.fill();

	// 乌龟头部（向右，在脖子末端）
	pCtx.beginPath();
	pCtx.ellipse(28, -3, 8, 6, 0, 0, Math.PI * 2);
	pCtx.fill();

	// 乌龟眼睛（右眼）
	pCtx.fillStyle = '#212121';
	pCtx.beginPath();
	pCtx.arc(32, -4, 2, 0, Math.PI * 2);
	pCtx.fill();
	pCtx.fillStyle = '#fff';
	pCtx.beginPath();
	pCtx.arc(32.5, -4.5, 0.8, 0, Math.PI * 2);
	pCtx.fill();

	// 乌龟嘴巴（向右）
	pCtx.strokeStyle = '#212121';
	pCtx.lineWidth = 1.5;
	pCtx.beginPath();
	pCtx.moveTo(35, -3);
	pCtx.lineTo(37, -2);
	pCtx.stroke();

	// 乌龟前腿（右前腿）
	pCtx.fillStyle = '#66bb6a';
	pCtx.beginPath();
	pCtx.ellipse(15, 8, 5, 8, 0.3, 0, Math.PI * 2);
	pCtx.fill();
	// 左前腿
	pCtx.beginPath();
	pCtx.ellipse(5, 8, 5, 8, -0.3, 0, Math.PI * 2);
	pCtx.fill();

	// 乌龟后腿（右后腿）
	pCtx.beginPath();
	pCtx.ellipse(10, 12, 5, 7, 0.2, 0, Math.PI * 2);
	pCtx.fill();
	// 左后腿
	pCtx.beginPath();
	pCtx.ellipse(-10, 12, 5, 7, -0.2, 0, Math.PI * 2);
	pCtx.fill();

	// 乌龟尾巴（向右后方）
	pCtx.fillStyle = '#2e7d32';
	pCtx.beginPath();
	pCtx.moveTo(-18, 5);
	pCtx.lineTo(-22, 8);
	pCtx.lineTo(-20, 10);
	pCtx.closePath();
	pCtx.fill();

	// 乌龟壳边缘高光
	pCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
	pCtx.lineWidth = 2;
	pCtx.beginPath();
	pCtx.ellipse(0, -12, 18, 12, 0, 0, Math.PI * 2);
	pCtx.stroke();

	pCtx.restore();
}

// 绘制小兔子
// 绘制小兔子
function drawRabbit(x, y, scale = 1, faceLeft = false, pCtx = ctx) {
	pCtx.save();
	pCtx.translate(x, y);
	if (faceLeft) pCtx.scale(-1, 1);
	pCtx.scale(scale, scale);

	// 身体
	pCtx.fillStyle = '#f5f5f5';
	pCtx.beginPath();
	pCtx.ellipse(0, 0, 18, 22, 0, 0, Math.PI * 2);
	pCtx.fill();

	// 头部
	pCtx.beginPath();
	pCtx.arc(0, -25, 15, 0, Math.PI * 2);
	pCtx.fill();

	// 长耳朵
	pCtx.fillStyle = '#ffe0e0';
	pCtx.beginPath();
	pCtx.ellipse(-8, -38, 4, 12, -0.2, 0, Math.PI * 2);
	pCtx.fill();
	pCtx.beginPath();
	pCtx.ellipse(8, -38, 4, 12, 0.2, 0, Math.PI * 2);
	pCtx.fill();

	// 外耳轮廓
	pCtx.strokeStyle = '#f5f5f5';
	pCtx.lineWidth = 2;
	pCtx.beginPath();
	pCtx.ellipse(-8, -38, 4, 12, -0.2, 0, Math.PI * 2);
	pCtx.stroke();
	pCtx.beginPath();
	pCtx.ellipse(8, -38, 4, 12, 0.2, 0, Math.PI * 2);
	pCtx.stroke();

	// 眼睛
	pCtx.fillStyle = '#333';
	pCtx.beginPath();
	pCtx.arc(-5, -27, 2, 0, Math.PI * 2);
	pCtx.fill();
	pCtx.beginPath();
	pCtx.arc(5, -27, 2, 0, Math.PI * 2);
	pCtx.fill();

	// 鼻子
	pCtx.fillStyle = '#ff69b4';
	pCtx.beginPath();
	pCtx.arc(0, -22, 2, 0, Math.PI * 2);
	pCtx.fill();

	// 嘴巴（可爱的Y形）
	pCtx.strokeStyle = '#333';
	pCtx.lineWidth = 1;
	pCtx.beginPath();
	pCtx.moveTo(0, -22);
	pCtx.lineTo(0, -18);
	pCtx.moveTo(0, -18);
	pCtx.lineTo(-3, -16);
	pCtx.moveTo(0, -18);
	pCtx.lineTo(3, -16);
	pCtx.stroke();

	// 前腿
	pCtx.fillStyle = '#f5f5f5';
	pCtx.beginPath();
	pCtx.ellipse(-8, 15, 4, 10, 0, 0, Math.PI * 2);
	pCtx.fill();
	pCtx.beginPath();
	pCtx.ellipse(8, 15, 4, 10, 0, 0, Math.PI * 2);
	pCtx.fill();

	// 尾巴（小绒球）
	pCtx.beginPath();
	pCtx.arc(-15, 5, 6, 0, Math.PI * 2);
	pCtx.fill();

	pCtx.restore();
}

// 绘制蘑菇
// 绘制蘑菇
function drawMushroom(x, y, color, size, pCtx = ctx) {
	pCtx.save();
	// 蘑菇杆
	pCtx.fillStyle = '#f5f5dc';
	pCtx.fillRect(x - size / 3, y - size, size * 0.66, size);

	// 蘑菇帽
	pCtx.fillStyle = color;
	pCtx.beginPath();
	pCtx.ellipse(x, y - size, size, size * 0.6, 0, Math.PI, 0, true);
	pCtx.fill();

	// 蘑菇斑点
	pCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
	for (let i = 0; i < 3; i++) {
		const angle = (i / 3) * Math.PI - Math.PI / 2;
		const px = x + Math.cos(angle) * size * 0.5;
		const py = y - size - Math.sin(angle) * size * 0.3;
		pCtx.beginPath();
		pCtx.arc(px, py, size * 0.15, 0, Math.PI * 2);
		pCtx.fill();
	}
	pCtx.restore();
}

// 绘制小花
function drawFlower(x, y, color, size, pCtx = ctx) {
	pCtx.save();
	// 花茎
	pCtx.strokeStyle = '#4caf50';
	pCtx.lineWidth = 2;
	pCtx.beginPath();
	pCtx.moveTo(x, y);
	pCtx.lineTo(x, y - size * 1.5);
	pCtx.stroke();

	// 花瓣（5瓣）
	pCtx.fillStyle = color;
	for (let i = 0; i < 5; i++) {
		const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
		const px = x + Math.cos(angle) * size * 0.6;
		const py = y - size * 1.5 + Math.sin(angle) * size * 0.6;
		pCtx.beginPath();
		pCtx.arc(px, py, size * 0.4, 0, Math.PI * 2);
		pCtx.fill();
	}

	// 花心
	pCtx.fillStyle = '#ffeb3b';
	pCtx.beginPath();
	pCtx.arc(x, y - size * 1.5, size * 0.3, 0, Math.PI * 2);
	pCtx.fill();
	pCtx.restore();
}

function drawCloud(x, y, size) {
	// 云朵身体
	ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
	ctx.beginPath();
	ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
	ctx.arc(x + size * 0.5, y, size * 0.7, 0, Math.PI * 2);
	ctx.arc(x + size, y, size * 0.6, 0, Math.PI * 2);
	ctx.arc(x + size * 0.3, y - size * 0.3, size * 0.5, 0, Math.PI * 2);
	ctx.arc(x + size * 0.7, y - size * 0.3, size * 0.5, 0, Math.PI * 2);
	ctx.fill();

	// 云朵眼睛（可爱的圆眼睛）
	ctx.fillStyle = '#333';
	ctx.beginPath();
	ctx.arc(x + size * 0.35, y - size * 0.1, size * 0.08, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(x + size * 0.65, y - size * 0.1, size * 0.08, 0, Math.PI * 2);
	ctx.fill();

	// 眼睛高光（让眼睛更有神）
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	ctx.arc(x + size * 0.35 - 2, y - size * 0.1 - 2, size * 0.03, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(x + size * 0.65 - 2, y - size * 0.1 - 2, size * 0.03, 0, Math.PI * 2);
	ctx.fill();

	// 云朵嘴巴（甜美的微笑）
	ctx.strokeStyle = '#ff9999';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(x + size * 0.5, y + size * 0.1, size * 0.25, 0.2, Math.PI - 0.2);
	ctx.stroke();

	// 云朵脸颊（粉色腮红）
	ctx.fillStyle = 'rgba(255, 182, 193, 0.4)';
	ctx.beginPath();
	ctx.arc(x + size * 0.15, y + size * 0.05, size * 0.12, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(x + size * 0.85, y + size * 0.05, size * 0.12, 0, Math.PI * 2);
	ctx.fill();
}

function drawTree(tree, groundY) {
	const x = tree.x;
	const swayAngle = tree.swayAngle;
	const stage = tree.growthStage || 1;

	// 基础高度随等级增长
	const baseHeight = 40 + (stage - 1) * 8; // 每级增加8像素
	const trunkWidth = 16;
	const crownSize = 35 + (stage - 1) * 5; // 树冠也随等级增大

	ctx.save();
	ctx.translate(x, groundY);

	// 应用摆动效果（从树根开始旋转）
	ctx.rotate(swayAngle);

	// 树干（渐变色，更立体）
	const trunkGrad = ctx.createLinearGradient(-trunkWidth / 2, -baseHeight, trunkWidth / 2, 0);
	trunkGrad.addColorStop(0, '#a0522d');
	trunkGrad.addColorStop(0.5, '#8b4513');
	trunkGrad.addColorStop(1, '#6b3410');
	ctx.fillStyle = trunkGrad;
	ctx.fillRect(-trunkWidth / 2, -baseHeight, trunkWidth, baseHeight);

	// 树干纹理（木纹）
	ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
	ctx.lineWidth = 2;
	for (let i = 0; i < 3; i++) {
		const yPos = -baseHeight + (i + 1) * (baseHeight / 4);
		ctx.beginPath();
		ctx.moveTo(-trunkWidth / 2 + 2, yPos);
		ctx.lineTo(trunkWidth / 2 - 2, yPos);
		ctx.stroke();
	}

	// 树冠（多层，更丰富）
	const crownY = -baseHeight - 10;

	// 深绿色底层（阴影）
	ctx.fillStyle = '#1a6b1a';
	ctx.beginPath();
	ctx.arc(0, crownY, crownSize * 1.1, 0, Math.PI * 2);
	ctx.fill();

	// 主树冠（中央）
	const crownGrad = ctx.createRadialGradient(0, crownY - 10, 0, 0, crownY, crownSize);
	crownGrad.addColorStop(0, '#90ee90');
	crownGrad.addColorStop(0.5, '#32cd32');
	crownGrad.addColorStop(1, '#228b22');
	ctx.fillStyle = crownGrad;
	ctx.beginPath();
	ctx.arc(0, crownY, crownSize, 0, Math.PI * 2);
	ctx.fill();

	// 左侧树冠
	ctx.fillStyle = '#2e8b57';
	ctx.beginPath();
	ctx.arc(-crownSize * 0.4, crownY - crownSize * 0.3, crownSize * 0.7, 0, Math.PI * 2);
	ctx.fill();

	// 右侧树冠
	ctx.beginPath();
	ctx.arc(crownSize * 0.4, crownY - crownSize * 0.3, crownSize * 0.7, 0, Math.PI * 2);
	ctx.fill();

	// 树冠高光（让树更立体）
	ctx.fillStyle = 'rgba(144, 238, 144, 0.4)';
	ctx.beginPath();
	ctx.arc(-crownSize * 0.2, crownY - crownSize * 0.4, crownSize * 0.3, 0, Math.PI * 2);
	ctx.fill();

	// 树叶细节（随等级增加更多叶子）
	if (stage >= 2) {
		ctx.fillStyle = '#3cb371';
		for (let i = 0; i < stage; i++) {
			const angle = (i / stage) * Math.PI * 2;
			const leafX = Math.cos(angle) * crownSize * 0.8;
			const leafY = crownY + Math.sin(angle) * crownSize * 0.8;
			ctx.beginPath();
			ctx.ellipse(leafX, leafY, 8, 12, angle, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// 果实（等级3+）
	if (stage >= 3) {
		ctx.fillStyle = '#ff6347';
		const fruitCount = Math.min(stage - 2, 5);
		for (let i = 0; i < fruitCount; i++) {
			const angle = (i / fruitCount) * Math.PI * 2 + Math.PI / 4;
			const fruitX = Math.cos(angle) * crownSize * 0.6;
			const fruitY = crownY + Math.sin(angle) * crownSize * 0.6;
			ctx.beginPath();
			ctx.arc(fruitX, fruitY, 5, 0, Math.PI * 2);
			ctx.fill();
			// 果实高光
			ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
			ctx.beginPath();
			ctx.arc(fruitX - 2, fruitY - 2, 2, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#ff6347';
		}
	}

	// 花朵（等级5）
	if (stage >= 5) {
		ctx.fillStyle = '#ffb6c1';
		for (let i = 0; i < 8; i++) {
			const angle = (i / 8) * Math.PI * 2;
			const flowerX = Math.cos(angle) * crownSize * 0.9;
			const flowerY = crownY + Math.sin(angle) * crownSize * 0.9;
			// 花瓣
			for (let p = 0; p < 5; p++) {
				const petalAngle = angle + (p / 5) * Math.PI * 2;
				ctx.beginPath();
				ctx.arc(
					flowerX + Math.cos(petalAngle) * 4,
					flowerY + Math.sin(petalAngle) * 4,
					3, 0, Math.PI * 2
				);
				ctx.fill();
			}
			// 花心
			ctx.fillStyle = '#ffd700';
			ctx.beginPath();
			ctx.arc(flowerX, flowerY, 2, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#ffb6c1';
		}
	}

	ctx.restore();
}

function updateParticles() {
	for (let i = particles.length - 1; i >= 0; i--) {
		const p = particles[i];
		p.x += p.vx;
		p.y += p.vy;
		p.life -= 2;
		p.vy += 0.2; // 重力
		if (p.life <= 0) {
			particles.splice(i, 1);
		}
	}
}

function drawParticles() {
	for (const p of particles) {
		ctx.save();
		ctx.globalAlpha = p.life / 100;
		ctx.fillStyle = p.color;
		ctx.beginPath();
		ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}
}

function createParticles(x, y, color, count = 10) {
	const actual = lowPowerMode ? Math.min(6, count) : count;
	for (let i = 0; i < actual; i++) {
		particles.push({
			x, y,
			vx: (Math.random() - 0.5) * 4,
			vy: (Math.random() - 0.5) * 4 - 2,
			life: 100,
			color: color,
			size: 2 + Math.random() * 3
		});
	}
	// 限制粒子总量（低配更严格，性能优化）
	const maxParticles = lowPowerMode ? 40 : 120;
	if (particles.length > maxParticles) {
		particles.splice(0, particles.length - maxParticles);
	}
}

// 创建浮动文字提示
function createFloatingText(x, y, text, color) {
	floatingTexts.push({
		x: x + 80, // 在词条右侧显示
		y: y,
		text: text,
		color: color,
		life: 120, // 持续时间
		scale: 0.5 // 初始缩放
	});
}

// 更新浮动文字
function updateFloatingTexts() {
	for (let i = floatingTexts.length - 1; i >= 0; i--) {
		const ft = floatingTexts[i];
		ft.y -= 1.5; // 向上浮动
		ft.life -= 2;
		// 缩放动画：0.5 -> 1.2 -> 1.0
		if (ft.life > 100) {
			ft.scale = 0.5 + (120 - ft.life) / 20 * 0.7; // 0.5 -> 1.2
		} else if (ft.scale > 1.0) {
			ft.scale -= 0.02; // 1.2 -> 1.0
		}
		if (ft.life <= 0) {
			floatingTexts.splice(i, 1);
		}
	}
}

// 绘制浮动文字
function drawFloatingTexts() {
	for (const ft of floatingTexts) {
		ctx.save();
		ctx.globalAlpha = ft.life / 120;
		const base = lowPowerMode ? 18 : 24;
		ctx.font = `bold ${base * ft.scale}px "Microsoft YaHei", SimHei, Arial`;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		// 低配模式移除描边以减少两次文字绘制
		if (!lowPowerMode) {
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 4;
			ctx.strokeText(ft.text, ft.x, ft.y);
		}
		// 文字填充
		ctx.fillStyle = ft.color;
		ctx.fillText(ft.text, ft.x, ft.y);
		ctx.restore();
	}
}

// 图片缓存对象
const birdImages = {
	right: null,
	left: null,
	rightLoaded: false,
	leftLoaded: false
};

// 预加载大嘴鸟图片
function preloadBirdImages() {
	// 加载向右的图片
	birdImages.right = new Image();
	birdImages.right.onload = function () {
		birdImages.rightLoaded = true;
		console.log('kright.png 加载成功');
	};
	birdImages.right.onerror = function () {
		console.warn('大嘴鸟图片加载失败：kright.png');
		birdImages.rightLoaded = false;
	};
	birdImages.right.src = 'kright.png';

	// 加载向左的图片
	birdImages.left = new Image();
	birdImages.left.onload = function () {
		birdImages.leftLoaded = true;
		console.log('kleft.png 加载成功');
	};
	birdImages.left.onerror = function () {
		console.warn('大嘴鸟图片加载失败：kleft.png');
		birdImages.leftLoaded = false;
	};
	birdImages.left.src = 'kleft.png';
}

// 页面加载时预加载图片
preloadBirdImages();

function drawBird() {
	ctx.save();
	ctx.translate(bird.x, bird.y);

	// 计算朝向角度（朝向目标或移动方向）
	let angle = 0;
	if (bird.target) {
		angle = Math.atan2(bird.target.y - bird.y, bird.target.x - bird.x);
	} else if (bird.idleMode && bird.nextIdleTarget) {
		angle = Math.atan2(bird.nextIdleTarget.y - bird.y, bird.nextIdleTarget.x - bird.x);
	} else if (bird.vx !== 0 || bird.vy !== 0) {
		angle = Math.atan2(bird.vy, bird.vx);
	}

	// 判断水平移动方向（只看x方向）
	// 向右移动（含右上、右下）：dx > 0 → 使用 kright.png
	// 向左移动（含左上、左下）：dx < 0 → 使用 kleft.png
	// 垂直移动（dx === 0）：根据角度判断（-90° 到 90° 之间表示向右）
	let dx = 0;
	if (bird.target) {
		dx = bird.target.x - bird.x;
	} else if (bird.idleMode && bird.nextIdleTarget) {
		dx = bird.nextIdleTarget.x - bird.x;
	} else if (bird.vx !== 0) {
		dx = bird.vx;
	}

	// 将角度转换为度数
	const angleDeg = angle * 180 / Math.PI;

	// 根据移动方向选择对应的图片
	// 关键：kright.png 是面向右侧的图片，kleft.png 是面向左侧的图片
	// 当使用 kleft.png 时，图片已经面向左侧，所以需要调整旋转角度
	let img, imageFile;
	let drawAngle = angle; // 实际绘制的角度

	if (dx > 0) {
		// 明确向右移动（含右上、右下）
		imageFile = 'kright.png';
		img = birdImages.right;
		drawAngle = angle; // 正常旋转
	} else if (dx < 0) {
		// 明确向左移动（含左上、左下）
		imageFile = 'kleft.png';
		img = birdImages.left;
		// kleft.png 已经面向左侧，需要调整角度
		// 如果角度是 -152.9°（左下），图片本身已经面向左，所以需要调整
		// 将角度转换为相对于左侧的角度
		drawAngle = angle + Math.PI; // 旋转180度，因为图片已经面向左
	} else {
		// dx === 0，垂直移动，根据角度判断
		// 角度在 -90° 到 90° 之间表示向右（右上、右下）
		if (Math.abs(angleDeg) <= 90) {
			imageFile = 'kright.png';
			img = birdImages.right;
			drawAngle = angle;
		} else {
			imageFile = 'kleft.png';
			img = birdImages.left;
			drawAngle = angle + Math.PI; // 旋转180度
		}
	}

	// 旋转到移动方向（使用调整后的角度）
	ctx.rotate(drawAngle);

	// 绘制图片（如果已加载）
	if (img) {
		// 检查图片是否已加载完成（使用多种方式检查）
		const isRightLoaded = imageFile === 'kright.png' && (birdImages.rightLoaded || (img.complete && img.naturalWidth > 0));
		const isLeftLoaded = imageFile === 'kleft.png' && (birdImages.leftLoaded || (img.complete && img.naturalWidth > 0));
		const isLoaded = isRightLoaded || isLeftLoaded;

		if (isLoaded) {
			const size = bird.size * 3; // 图片大小根据bird.size缩放
			ctx.drawImage(img, -size / 2, -size / 2, size, size);
		} else {
			// 图片未加载完成，显示占位符
			ctx.fillStyle = '#888';
			ctx.beginPath();
			ctx.arc(0, 0, bird.size, 0, Math.PI * 2);
			ctx.fill();
			// 调试信息
			console.warn(`${imageFile} 未加载完成，当前状态: rightLoaded=${birdImages.rightLoaded}, leftLoaded=${birdImages.leftLoaded}, complete=${img.complete}, naturalWidth=${img.naturalWidth}`);
		}
	} else {
		// 图片对象不存在，显示占位符
		ctx.fillStyle = '#888';
		ctx.beginPath();
		ctx.arc(0, 0, bird.size, 0, Math.PI * 2);
		ctx.fill();
		console.warn(`图片对象不存在: ${imageFile}, right=${birdImages.right}, left=${birdImages.left}`);
	}

	ctx.restore();
	return;

	// 1. 尾羽（Lv3+，在身体后面绘制）
	if (lv >= 3) {
		const tailColors = ['#26c6da', '#29b6f6', '#42a5f5', '#5c6bc0', '#ab47bc'];
		ctx.fillStyle = tailColors[lv - 1];
		ctx.beginPath();
		ctx.moveTo(-bird.size * 0.8, 0);
		ctx.lineTo(-bird.size * 1.5, -bird.size * 0.4);
		ctx.lineTo(-bird.size * 1.3, 0);
		ctx.lineTo(-bird.size * 1.5, bird.size * 0.4);
		ctx.closePath();
		ctx.fill();
		// 尾羽纹理
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(-bird.size * 1.2, -bird.size * 0.2);
		ctx.lineTo(-bird.size * 1.4, -bird.size * 0.3);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(-bird.size * 1.2, bird.size * 0.2);
		ctx.lineTo(-bird.size * 1.4, bird.size * 0.3);
		ctx.stroke();
	}

	// 2. 翅膀（Lv4+，在身体两侧）
	if (lv >= 4) {
		const wingColor = '#80deea';
		const time = Date.now() * 0.005;
		const flapAngle = Math.sin(time * 2) * 0.2; // 扇动效果

		// 左翅膀
		ctx.save();
		ctx.translate(-bird.size * 0.5, 0);
		ctx.rotate(-0.3 + flapAngle);
		ctx.fillStyle = wingColor;
		ctx.beginPath();
		ctx.ellipse(0, 0, bird.size * 0.6, bird.size * 1.2, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// 右翅膀
		ctx.save();
		ctx.translate(-bird.size * 0.5, 0);
		ctx.rotate(0.3 - flapAngle);
		ctx.fillStyle = wingColor;
		ctx.beginPath();
		ctx.ellipse(0, 0, bird.size * 0.6, bird.size * 1.2, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	// 3. 身体（椭圆形，卡通风格）
	ctx.fillStyle = bodyColor;
	ctx.beginPath();
	ctx.ellipse(0, 0, bird.size * 1.1, bird.size, 0, 0, Math.PI * 2);
	ctx.fill();

	// 身体轮廓线
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
	ctx.lineWidth = 2;
	ctx.stroke();

	// 4. 肚皮（Lv2+）
	if (lv >= 2) {
		ctx.fillStyle = bellyColor;
		ctx.beginPath();
		ctx.ellipse(bird.size * 0.2, bird.size * 0.1, bird.size * 0.6, bird.size * 0.7, 0, 0, Math.PI * 2);
		ctx.fill();
	}

	// 5. 大嘴巴（标志性特征）
	// 上喙
	ctx.fillStyle = beakColor;
	ctx.beginPath();
	ctx.moveTo(bird.size * 0.8, -bird.size * 0.3);
	ctx.quadraticCurveTo(bird.size * 1.8, -bird.size * 0.4, bird.size * 2.2, -bird.size * 0.1);
	ctx.lineTo(bird.size * 2.2, 0);
	ctx.lineTo(bird.size * 0.8, 0);
	ctx.closePath();
	ctx.fill();

	// 下喙
	ctx.beginPath();
	ctx.moveTo(bird.size * 0.8, 0);
	ctx.lineTo(bird.size * 2.2, 0);
	ctx.quadraticCurveTo(bird.size * 1.8, bird.size * 0.3, bird.size * 0.8, bird.size * 0.2);
	ctx.closePath();
	ctx.fill();

	// 喙的高光
	ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
	ctx.beginPath();
	ctx.ellipse(bird.size * 1.5, -bird.size * 0.15, bird.size * 0.3, bird.size * 0.1, 0, 0, Math.PI * 2);
	ctx.fill();

	// 喙的轮廓
	ctx.strokeStyle = '#e65100';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(bird.size * 0.8, -bird.size * 0.3);
	ctx.quadraticCurveTo(bird.size * 1.8, -bird.size * 0.4, bird.size * 2.2, -bird.size * 0.1);
	ctx.stroke();

	// 6. 眼睛（大大的卡通眼睛）
	// 眼白
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	ctx.ellipse(bird.size * 0.3, -bird.size * 0.4, bird.size * 0.35, bird.size * 0.4, 0, 0, Math.PI * 2);
	ctx.fill();

	// 眼珠
	ctx.fillStyle = '#111';
	ctx.beginPath();
	ctx.arc(bird.size * 0.4, -bird.size * 0.35, bird.size * 0.15, 0, Math.PI * 2);
	ctx.fill();

	// 眼睛高光（让眼睛更有神）
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	ctx.arc(bird.size * 0.45, -bird.size * 0.4, bird.size * 0.06, 0, Math.PI * 2);
	ctx.fill();

	// 眼睛轮廓
	ctx.strokeStyle = '#000';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(bird.size * 0.3, -bird.size * 0.4, bird.size * 0.35, bird.size * 0.4, 0, 0, Math.PI * 2);
	ctx.stroke();

	// 7. 头冠（Lv3+）
	if (lv >= 3) {
		const crestColors = ['#ff4081', '#e91e63', '#f06292', '#ba68c8', '#ce93d8'];
		ctx.fillStyle = crestColors[lv - 1];

		// 多根羽毛
		for (let i = 0; i < lv - 1; i++) {
			const offsetX = (i - (lv - 2) / 2) * bird.size * 0.2;
			ctx.beginPath();
			ctx.moveTo(offsetX - bird.size * 0.1, -bird.size * 0.8);
			ctx.lineTo(offsetX, -bird.size * 1.3);
			ctx.lineTo(offsetX + bird.size * 0.1, -bird.size * 0.8);
			ctx.closePath();
			ctx.fill();
		}
	}

	// 8. 小腿和爪子（Lv5）
	if (lv >= 5) {
		ctx.restore(); // 先恢复旋转
		ctx.save();
		ctx.translate(bird.x, bird.y);

		ctx.strokeStyle = '#ff6f00';
		ctx.lineWidth = 3;

		// 左腿
		ctx.beginPath();
		ctx.moveTo(-bird.size * 0.3, bird.size * 0.8);
		ctx.lineTo(-bird.size * 0.3, bird.size * 1.2);
		ctx.stroke();
		// 左爪
		ctx.beginPath();
		ctx.moveTo(-bird.size * 0.3, bird.size * 1.2);
		ctx.lineTo(-bird.size * 0.5, bird.size * 1.35);
		ctx.moveTo(-bird.size * 0.3, bird.size * 1.2);
		ctx.lineTo(-bird.size * 0.1, bird.size * 1.35);
		ctx.stroke();

		// 右腿
		ctx.beginPath();
		ctx.moveTo(bird.size * 0.3, bird.size * 0.8);
		ctx.lineTo(bird.size * 0.3, bird.size * 1.2);
		ctx.stroke();
		// 右爪
		ctx.beginPath();
		ctx.moveTo(bird.size * 0.3, bird.size * 1.2);
		ctx.lineTo(bird.size * 0.1, bird.size * 1.35);
		ctx.moveTo(bird.size * 0.3, bird.size * 1.2);
		ctx.lineTo(bird.size * 0.5, bird.size * 1.35);
		ctx.stroke();
	}

	ctx.restore();
}

function drawItems() {
	for (const it of items) {
		ctx.save();
		// 低配模式不做阴影与动态脉冲，减少重绘成本
		if (!lowPowerMode) {
			const time = Date.now() * 0.005;
			void Math.sin(time + it.x * 0.01); // 仅保留读取以避免移除过多代码
			ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
			ctx.shadowBlur = 8;
			ctx.shadowOffsetX = 2;
			ctx.shadowOffsetY = 2;
		} else {
			ctx.shadowBlur = 0;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
		}

		// 使用词条自己的颜色
		const colors = it.colors || ['#ffe08a', '#ffc241'];
		const grad = ctx.createLinearGradient(it.x, it.y - it.h / 2, it.x, it.y + it.h / 2);
		grad.addColorStop(0, colors[0]);
		grad.addColorStop(1, colors[1]);
		ctx.fillStyle = grad;

		// 根据形状类型绘制不同的形状
		const shape = it.shape || 'rect';
		drawShape(ctx, it.x, it.y, it.w, it.h, shape);

		// 边框
		if (!lowPowerMode) {
			ctx.shadowBlur = 0;
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
			ctx.lineWidth = 3;
			drawShape(ctx, it.x, it.y, it.w, it.h, shape, true);
		}

		// 绘制卡通图案（低配模式跳过）
		if (!lowPowerMode) {
			const patternType = it.patternType || 'apple';
			drawCartoonPattern(ctx, it.x, it.y - 12, patternType, it.w * 0.6);
		}

		// 文本（在图案下方，所有词条统一使用与两字词相同的大小）
		ctx.fillStyle = '#222';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// 所有词条统一使用21px基础字号，无论几字词
		// 最小字号也是21px，确保所有词条都保持相同大小
		let fs = 21;
		const maxW = it.w - 20;
		ctx.font = `bold ${fs}px "Microsoft YaHei", SimHei, Arial`;
		// 最小字号为21px，不再缩小
		while (ctx.measureText(it.text).width > maxW && fs > 21) {
			fs -= 1;
			ctx.font = `bold ${fs}px "Microsoft YaHei", SimHei, Arial`;
		}

		// 文字描边效果
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
		ctx.lineWidth = 2;
		ctx.strokeText(it.text, it.x, it.y + 8);
		ctx.fillText(it.text, it.x, it.y + 8);
		ctx.restore();
	}
}

// 绘制卡通图案
function drawCartoonPattern(ctx, x, y, patternType, size) {
	ctx.save();
	ctx.translate(x, y);

	const scale = size / 40; // 基础尺寸为40，根据传入size缩放

	switch (patternType) {
		// 水果类
		case 'apple':
			// 苹果身体
			ctx.fillStyle = '#ff4444';
			ctx.beginPath();
			ctx.ellipse(0, 0, 12 * scale, 15 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 苹果叶子
			ctx.fillStyle = '#4caf50';
			ctx.beginPath();
			ctx.ellipse(0, -15 * scale, 4 * scale, 6 * scale, -0.3, 0, Math.PI * 2);
			ctx.fill();
			// 高光
			ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
			ctx.beginPath();
			ctx.arc(-5 * scale, -5 * scale, 4 * scale, 0, Math.PI * 2);
			ctx.fill();
			break;

		case 'orange':
			// 橙子身体
			ctx.fillStyle = '#ff9800';
			ctx.beginPath();
			ctx.arc(0, 0, 14 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 橙子纹理
			ctx.strokeStyle = 'rgba(255, 152, 0, 0.5)';
			ctx.lineWidth = 1;
			for (let i = 0; i < 6; i++) {
				const angle = (i / 6) * Math.PI * 2;
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(Math.cos(angle) * 14 * scale, Math.sin(angle) * 14 * scale);
				ctx.stroke();
			}
			// 高光
			ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
			ctx.beginPath();
			ctx.arc(-6 * scale, -6 * scale, 5 * scale, 0, Math.PI * 2);
			ctx.fill();
			break;

		case 'strawberry':
			// 草莓身体
			ctx.fillStyle = '#f44336';
			ctx.beginPath();
			ctx.moveTo(0, 10 * scale);
			ctx.quadraticCurveTo(-8 * scale, -5 * scale, 0, -12 * scale);
			ctx.quadraticCurveTo(8 * scale, -5 * scale, 0, 10 * scale);
			ctx.closePath();
			ctx.fill();
			// 草莓叶子
			ctx.fillStyle = '#4caf50';
			ctx.beginPath();
			ctx.arc(-6 * scale, -12 * scale, 3 * scale, 0, Math.PI * 2);
			ctx.arc(0, -15 * scale, 3 * scale, 0, Math.PI * 2);
			ctx.arc(6 * scale, -12 * scale, 3 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 草莓籽
			ctx.fillStyle = '#ffeb3b';
			for (let i = 0; i < 8; i++) {
				const angle = (i / 8) * Math.PI * 2;
				const dist = 6 + (i % 2) * 2;
				ctx.beginPath();
				ctx.arc(Math.cos(angle) * dist * scale, Math.sin(angle) * dist * scale, 1.5 * scale, 0, Math.PI * 2);
				ctx.fill();
			}
			break;

		case 'banana':
			// 香蕉身体
			ctx.fillStyle = '#ffeb3b';
			ctx.beginPath();
			ctx.moveTo(-8 * scale, 8 * scale);
			ctx.quadraticCurveTo(-10 * scale, -5 * scale, -5 * scale, -10 * scale);
			ctx.quadraticCurveTo(0, -12 * scale, 5 * scale, -8 * scale);
			ctx.quadraticCurveTo(8 * scale, 0, 8 * scale, 8 * scale);
			ctx.closePath();
			ctx.fill();
			// 香蕉纹理
			ctx.strokeStyle = 'rgba(255, 193, 7, 0.6)';
			ctx.lineWidth = 1;
			for (let i = 0; i < 3; i++) {
				ctx.beginPath();
				ctx.moveTo(-5 * scale + i * 5 * scale, -8 * scale);
				ctx.lineTo(-3 * scale + i * 3 * scale, 6 * scale);
				ctx.stroke();
			}
			break;

		case 'grape':
			// 葡萄串
			ctx.fillStyle = '#9c27b0';
			for (let row = 0; row < 3; row++) {
				const count = row === 0 ? 2 : row === 1 ? 3 : 2;
				for (let i = 0; i < count; i++) {
					const offsetX = (i - (count - 1) / 2) * 6 * scale;
					const offsetY = (row - 1) * 6 * scale;
					ctx.beginPath();
					ctx.arc(offsetX, offsetY, 4 * scale, 0, Math.PI * 2);
					ctx.fill();
					// 高光
					ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
					ctx.beginPath();
					ctx.arc(offsetX - 1.5 * scale, offsetY - 1.5 * scale, 1.5 * scale, 0, Math.PI * 2);
					ctx.fill();
					ctx.fillStyle = '#9c27b0';
				}
			}
			// 葡萄藤
			ctx.strokeStyle = '#4caf50';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(0, -10 * scale);
			ctx.lineTo(0, -14 * scale);
			ctx.stroke();
			break;

		case 'cherry':
			// 樱桃1
			ctx.fillStyle = '#e91e63';
			ctx.beginPath();
			ctx.arc(-4 * scale, 2 * scale, 5 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 樱桃2
			ctx.beginPath();
			ctx.arc(4 * scale, 2 * scale, 5 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 高光
			ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
			ctx.beginPath();
			ctx.arc(-5 * scale, 1 * scale, 2 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(3 * scale, 1 * scale, 2 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 樱桃梗
			ctx.strokeStyle = '#4caf50';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(-4 * scale, -3 * scale);
			ctx.lineTo(0, -8 * scale);
			ctx.lineTo(4 * scale, -3 * scale);
			ctx.stroke();
			break;

		case 'watermelon':
			// 西瓜身体
			ctx.fillStyle = '#4caf50';
			ctx.beginPath();
			ctx.ellipse(0, 0, 12 * scale, 8 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 西瓜条纹
			ctx.strokeStyle = '#2e7d32';
			ctx.lineWidth = 2;
			for (let i = -1; i <= 1; i++) {
				ctx.beginPath();
				ctx.moveTo(-12 * scale, i * 4 * scale);
				ctx.lineTo(12 * scale, i * 4 * scale);
				ctx.stroke();
			}
			// 西瓜果肉（内部）
			ctx.fillStyle = '#ff5252';
			ctx.beginPath();
			ctx.ellipse(0, 0, 8 * scale, 5 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 西瓜籽
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(2 * scale, 0, 1 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(-2 * scale, 0, 1 * scale, 0, Math.PI * 2);
			ctx.fill();
			break;

		case 'pineapple':
			// 菠萝身体
			ctx.fillStyle = '#ffc107';
			ctx.beginPath();
			ctx.ellipse(0, 0, 10 * scale, 14 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 菠萝纹理
			ctx.strokeStyle = '#ff8f00';
			ctx.lineWidth = 1.5;
			for (let i = 0; i < 6; i++) {
				const angle = (i / 6) * Math.PI * 2;
				ctx.beginPath();
				ctx.moveTo(0, -14 * scale);
				ctx.lineTo(Math.cos(angle) * 10 * scale, Math.sin(angle) * 10 * scale);
				ctx.stroke();
			}
			// 菠萝叶子
			ctx.fillStyle = '#4caf50';
			for (let i = 0; i < 5; i++) {
				const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
				ctx.beginPath();
				ctx.moveTo(0, -14 * scale);
				ctx.lineTo(Math.cos(angle) * 6 * scale, -14 * scale + Math.sin(angle) * 8 * scale);
				ctx.lineTo(Math.cos(angle) * 3 * scale, -14 * scale + Math.sin(angle) * 4 * scale);
				ctx.closePath();
				ctx.fill();
			}
			break;

		case 'peach':
			// 桃子身体
			ctx.fillStyle = '#ffb3ba';
			ctx.beginPath();
			ctx.ellipse(0, 0, 12 * scale, 14 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 桃子高光
			ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
			ctx.beginPath();
			ctx.arc(-4 * scale, -4 * scale, 5 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 桃子叶子
			ctx.fillStyle = '#4caf50';
			ctx.beginPath();
			ctx.ellipse(0, -14 * scale, 3 * scale, 5 * scale, -0.2, 0, Math.PI * 2);
			ctx.fill();
			break;

		// 昆虫类
		case 'butterfly':
			// 蝴蝶身体
			ctx.fillStyle = '#795548';
			ctx.beginPath();
			ctx.ellipse(0, 0, 2 * scale, 8 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 上翅膀
			ctx.fillStyle = '#ff9800';
			ctx.beginPath();
			ctx.ellipse(-6 * scale, -4 * scale, 6 * scale, 5 * scale, -0.3, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.ellipse(6 * scale, -4 * scale, 6 * scale, 5 * scale, 0.3, 0, Math.PI * 2);
			ctx.fill();
			// 下翅膀
			ctx.fillStyle = '#ffc107';
			ctx.beginPath();
			ctx.ellipse(-5 * scale, 2 * scale, 5 * scale, 4 * scale, 0.2, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.ellipse(5 * scale, 2 * scale, 5 * scale, 4 * scale, -0.2, 0, Math.PI * 2);
			ctx.fill();
			// 翅膀斑点
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(-6 * scale, -4 * scale, 2 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(6 * scale, -4 * scale, 2 * scale, 0, Math.PI * 2);
			ctx.fill();
			break;

		case 'bee':
			// 蜜蜂身体
			ctx.fillStyle = '#ffc107';
			ctx.beginPath();
			ctx.ellipse(0, 0, 6 * scale, 4 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 蜜蜂条纹
			ctx.fillStyle = '#212121';
			ctx.fillRect(-6 * scale, -2 * scale, 12 * scale, 1.5 * scale);
			ctx.fillRect(-6 * scale, 0.5 * scale, 12 * scale, 1.5 * scale);
			// 蜜蜂翅膀
			ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
			ctx.beginPath();
			ctx.ellipse(-4 * scale, -5 * scale, 3 * scale, 4 * scale, -0.3, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.ellipse(4 * scale, -5 * scale, 3 * scale, 4 * scale, 0.3, 0, Math.PI * 2);
			ctx.fill();
			// 蜜蜂眼睛
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(-2 * scale, -1 * scale, 1.5 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(2 * scale, -1 * scale, 1.5 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 蜜蜂触角
			ctx.strokeStyle = '#212121';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(-3 * scale, -4 * scale);
			ctx.lineTo(-4 * scale, -6 * scale);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(3 * scale, -4 * scale);
			ctx.lineTo(4 * scale, -6 * scale);
			ctx.stroke();
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(-4 * scale, -6 * scale, 1 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(4 * scale, -6 * scale, 1 * scale, 0, Math.PI * 2);
			ctx.fill();
			break;

		case 'ladybug':
			// 瓢虫身体
			ctx.fillStyle = '#f44336';
			ctx.beginPath();
			ctx.ellipse(0, 0, 8 * scale, 6 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 瓢虫头部
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(0, -6 * scale, 4 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 瓢虫斑点
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(-3 * scale, -1 * scale, 1.5 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(3 * scale, -1 * scale, 1.5 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(0, 2 * scale, 1.5 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 瓢虫眼睛
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.arc(-2 * scale, -6 * scale, 1 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(2 * scale, -6 * scale, 1 * scale, 0, Math.PI * 2);
			ctx.fill();
			break;

		case 'dragonfly':
			// 蜻蜓身体
			ctx.fillStyle = '#00bcd4';
			ctx.beginPath();
			ctx.ellipse(0, 0, 1.5 * scale, 10 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 蜻蜓翅膀
			ctx.fillStyle = 'rgba(0, 188, 212, 0.3)';
			ctx.strokeStyle = '#00bcd4';
			ctx.lineWidth = 1.5;
			// 前翅
			ctx.beginPath();
			ctx.ellipse(-4 * scale, -3 * scale, 5 * scale, 2.5 * scale, -0.2, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.ellipse(4 * scale, -3 * scale, 5 * scale, 2.5 * scale, 0.2, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			// 后翅
			ctx.beginPath();
			ctx.ellipse(-3 * scale, 1 * scale, 4 * scale, 2 * scale, 0.2, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.ellipse(3 * scale, 1 * scale, 4 * scale, 2 * scale, -0.2, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			// 蜻蜓眼睛
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(-2 * scale, -8 * scale, 2 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(2 * scale, -8 * scale, 2 * scale, 0, Math.PI * 2);
			ctx.fill();
			break;

		case 'worm':
			// 大虫子身体（分段，弯曲）
			ctx.fillStyle = '#8bc34a'; // 绿色
			// 身体分段1
			ctx.beginPath();
			ctx.ellipse(-8 * scale, 0, 6 * scale, 4 * scale, 0.3, 0, Math.PI * 2);
			ctx.fill();
			// 身体分段2
			ctx.beginPath();
			ctx.ellipse(0, 2 * scale, 6 * scale, 4 * scale, -0.2, 0, Math.PI * 2);
			ctx.fill();
			// 身体分段3
			ctx.beginPath();
			ctx.ellipse(8 * scale, 0, 6 * scale, 4 * scale, 0.2, 0, Math.PI * 2);
			ctx.fill();
			// 虫子头部（稍大）
			ctx.fillStyle = '#689f38'; // 深绿色
			ctx.beginPath();
			ctx.ellipse(-10 * scale, -1 * scale, 5 * scale, 5 * scale, 0.3, 0, Math.PI * 2);
			ctx.fill();
			// 虫子眼睛
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(-11 * scale, -2 * scale, 1.5 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(-9 * scale, -2 * scale, 1.5 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 虫子身体纹理（分段线）
			ctx.strokeStyle = '#689f38';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(-2 * scale, 0);
			ctx.lineTo(-2 * scale, 4 * scale);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(6 * scale, 2 * scale);
			ctx.lineTo(6 * scale, 6 * scale);
			ctx.stroke();
			break;

		// 鸟类
		case 'bird':
			// 小鸟身体
			ctx.fillStyle = '#ff9800';
			ctx.beginPath();
			ctx.ellipse(0, 0, 6 * scale, 4 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 小鸟头部
			ctx.beginPath();
			ctx.arc(-4 * scale, -2 * scale, 3 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 小鸟翅膀
			ctx.fillStyle = '#ff6f00';
			ctx.beginPath();
			ctx.ellipse(2 * scale, 0, 4 * scale, 3 * scale, 0.3, 0, Math.PI * 2);
			ctx.fill();
			// 小鸟眼睛
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(-5 * scale, -2 * scale, 1 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 小鸟嘴巴
			ctx.fillStyle = '#ff6f00';
			ctx.beginPath();
			ctx.moveTo(-7 * scale, -2 * scale);
			ctx.lineTo(-9 * scale, -1 * scale);
			ctx.lineTo(-7 * scale, 0);
			ctx.closePath();
			ctx.fill();
			break;

		case 'parrot':
			// 鹦鹉身体
			ctx.fillStyle = '#4caf50';
			ctx.beginPath();
			ctx.ellipse(0, 0, 7 * scale, 5 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 鹦鹉头部
			ctx.fillStyle = '#ffeb3b';
			ctx.beginPath();
			ctx.arc(-5 * scale, -3 * scale, 4 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 鹦鹉翅膀
			ctx.fillStyle = '#2e7d32';
			ctx.beginPath();
			ctx.ellipse(3 * scale, 0, 5 * scale, 4 * scale, 0.2, 0, Math.PI * 2);
			ctx.fill();
			// 鹦鹉尾巴
			ctx.beginPath();
			ctx.moveTo(7 * scale, 0);
			ctx.lineTo(10 * scale, -3 * scale);
			ctx.lineTo(10 * scale, 3 * scale);
			ctx.closePath();
			ctx.fill();
			// 鹦鹉眼睛
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(-6 * scale, -3 * scale, 1.5 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 鹦鹉嘴巴
			ctx.fillStyle = '#ff6f00';
			ctx.beginPath();
			ctx.moveTo(-9 * scale, -3 * scale);
			ctx.lineTo(-11 * scale, -2 * scale);
			ctx.lineTo(-9 * scale, -1 * scale);
			ctx.closePath();
			ctx.fill();
			break;

		case 'eagle':
			// 老鹰身体
			ctx.fillStyle = '#795548';
			ctx.beginPath();
			ctx.ellipse(0, 0, 8 * scale, 5 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 老鹰头部
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.arc(-6 * scale, -3 * scale, 3 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 老鹰翅膀
			ctx.fillStyle = '#5d4037';
			ctx.beginPath();
			ctx.ellipse(3 * scale, -2 * scale, 6 * scale, 4 * scale, -0.2, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.ellipse(3 * scale, 2 * scale, 6 * scale, 4 * scale, 0.2, 0, Math.PI * 2);
			ctx.fill();
			// 老鹰眼睛
			ctx.fillStyle = '#ffc107';
			ctx.beginPath();
			ctx.arc(-7 * scale, -3 * scale, 1.5 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(-7 * scale, -3 * scale, 0.8 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 老鹰嘴巴
			ctx.fillStyle = '#ff6f00';
			ctx.beginPath();
			ctx.moveTo(-9 * scale, -3 * scale);
			ctx.lineTo(-11 * scale, -2 * scale);
			ctx.lineTo(-9 * scale, -1 * scale);
			ctx.closePath();
			ctx.fill();
			break;

		case 'owl':
			// 猫头鹰身体
			ctx.fillStyle = '#8d6e63';
			ctx.beginPath();
			ctx.ellipse(0, 0, 8 * scale, 10 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			// 猫头鹰头部
			ctx.fillStyle = '#a1887f';
			ctx.beginPath();
			ctx.arc(0, -6 * scale, 6 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 猫头鹰眼睛
			ctx.fillStyle = '#fff';
			ctx.beginPath();
			ctx.arc(-3 * scale, -6 * scale, 3 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(3 * scale, -6 * scale, 3 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#212121';
			ctx.beginPath();
			ctx.arc(-3 * scale, -6 * scale, 1.5 * scale, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(3 * scale, -6 * scale, 1.5 * scale, 0, Math.PI * 2);
			ctx.fill();
			// 猫头鹰嘴巴
			ctx.fillStyle = '#ff6f00';
			ctx.beginPath();
			ctx.moveTo(0, -3 * scale);
			ctx.lineTo(-2 * scale, -1 * scale);
			ctx.lineTo(2 * scale, -1 * scale);
			ctx.closePath();
			ctx.fill();
			// 猫头鹰耳朵
			ctx.fillStyle = '#8d6e63';
			ctx.beginPath();
			ctx.moveTo(-4 * scale, -12 * scale);
			ctx.lineTo(-6 * scale, -16 * scale);
			ctx.lineTo(-2 * scale, -14 * scale);
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(4 * scale, -12 * scale);
			ctx.lineTo(6 * scale, -16 * scale);
			ctx.lineTo(2 * scale, -14 * scale);
			ctx.closePath();
			ctx.fill();
			break;

		default:
			// 默认绘制苹果
			ctx.fillStyle = '#ff4444';
			ctx.beginPath();
			ctx.ellipse(0, 0, 12 * scale, 15 * scale, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#4caf50';
			ctx.beginPath();
			ctx.ellipse(0, -15 * scale, 4 * scale, 6 * scale, -0.3, 0, Math.PI * 2);
			ctx.fill();
			break;
	}

	ctx.restore();
}

// 绘制不同形状的函数
function drawShape(ctx, x, y, w, h, shape, strokeOnly = false) {
	ctx.beginPath();

	switch (shape) {
		case 'circle': // 圆形
			const radius = Math.min(w, h) / 2;
			ctx.arc(x, y, radius, 0, Math.PI * 2);
			break;

		case 'ellipse': // 椭圆
			ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
			break;

		case 'diamond': // 菱形
			ctx.moveTo(x, y - h / 2);
			ctx.lineTo(x + w / 2, y);
			ctx.lineTo(x, y + h / 2);
			ctx.lineTo(x - w / 2, y);
			ctx.closePath();
			break;

		case 'hexagon': // 六边形
			const hexRadius = Math.min(w, h) / 2;
			for (let i = 0; i < 6; i++) {
				const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
				const px = x + Math.cos(angle) * hexRadius;
				const py = y + Math.sin(angle) * hexRadius * 0.9;
				if (i === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.closePath();
			break;

		case 'star': // 星形
			const starRadius = Math.min(w, h) / 2;
			for (let i = 0; i < 10; i++) {
				const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
				const r = i % 2 === 0 ? starRadius : starRadius * 0.5;
				const px = x + Math.cos(angle) * r;
				const py = y + Math.sin(angle) * r;
				if (i === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.closePath();
			break;

		case 'cloud': // 云朵形
			const cloudW = w / 2;
			const cloudH = h / 2;
			ctx.arc(x - cloudW / 2, y, cloudH * 0.6, 0, Math.PI * 2);
			ctx.arc(x, y - cloudH / 4, cloudH * 0.7, 0, Math.PI * 2);
			ctx.arc(x + cloudW / 2, y, cloudH * 0.6, 0, Math.PI * 2);
			break;

		default: // 矩形（圆角）
			roundRect(x - w / 2, y - h / 2, w, h, 10);
			break;
	}

	if (strokeOnly) {
		ctx.stroke();
	} else {
		ctx.fill();
	}
}

function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }

function spawnItem() {
	try {
		// 如果level为0，使用第1级（索引0）的值
		const levelIndex = STATE.level > 0 ? STATE.level - 1 : 0;
		const baseMax = LEVELS[levelIndex].maxItems;
		const maxItems = lowPowerMode ? Math.max(2, Math.floor(baseMax * 0.7)) : baseMax;
		if (items.length >= maxItems) return;
		if (typeof sampleWord !== 'function') { showToast('词库未加载，请检查 words_*.js 引用', '#b91c1c'); return; }

		// 每9个正确词必出1个错误词
		let forceWrong = false;
		if (STATE.correctCounter >= 9) {
			forceWrong = true;
			STATE.correctCounter = 0; // 重置计数器
		}

		const w = sampleWord(STATE.probWrong, forceWrong);
		const x = 80 + Math.random() * (canvas.width - 160);
		const y = 80 + Math.random() * (canvas.height - 220);
		// 增大卡片宽度，让四字词加拼音有足够空间显示
		const cardW = 180, cardH = 56;

		// 随机形状类型（低配模式减少复杂形状）
		const shapes = lowPowerMode
			? ['rect', 'circle', 'ellipse']
			: ['circle', 'ellipse', 'diamond', 'hexagon', 'star', 'cloud', 'rect'];
		const shape = shapes[Math.floor(Math.random() * shapes.length)];

		// 随机颜色（多彩词条）
		const colors = [
			['#ffe08a', '#ffc241'], // 金黄
			['#ffc1e0', '#ff8ac9'], // 粉红
			['#a8e6ff', '#6ec5ff'], // 浅蓝
			['#c8ffb3', '#8fff7f'], // 浅绿
			['#ffd4a3', '#ffb366'], // 橙色
			['#e0b3ff', '#c57fff']  // 紫色
		];
		const colorPair = colors[Math.floor(Math.random() * colors.length)];

		// 随机卡通图案类型（包含大虫子）
		const patternTypes = ['apple', 'orange', 'strawberry', 'banana', 'grape',
			'butterfly', 'bee', 'ladybug', 'dragonfly', 'worm',
			'bird', 'parrot', 'eagle', 'owl',
			'cherry', 'watermelon', 'pineapple', 'peach'];
		const patternType = patternTypes[Math.floor(Math.random() * patternTypes.length)];

		items.push({
			x, y,
			text: w.text,
			correct: w.correct,
			right: w.right,
			w: cardW,
			h: cardH,
			ttl: 8000,
			shape: shape, // 形状类型
			colors: colorPair, // 颜色对
			patternType: patternType // 卡通图案类型
		});
	} catch (err) {
		console.error(err);
		showToast('生成词条失败', '#b91c1c');
	}
}

function update() {
	if (!STATE.running || STATE.paused) return;

	// 更新错误提示动画
	updateErrorPrompt();

	// 如果错误提示正在显示，暂停其他更新
	if (errorPrompt.active) {
		return;
	}

	// 更新粒子和浮动文字
	updateParticles();
	updateFloatingTexts();

	// 鸟的移动逻辑
	if (bird.target) {
		// 有目标：朝向目标移动
		bird.idleMode = false;
		bird.idleTimer = 0;

		// 如果level为0，使用第1级（索引0）的值
		const levelIndex = STATE.level > 0 ? STATE.level - 1 : 0;
		const spd = LEVELS[levelIndex].birdSpeed;
		const dx = bird.target.x - bird.x;
		const dy = bird.target.y - bird.y;
		const dist = Math.hypot(dx, dy);
		if (dist <= spd) {
			// 到达，吞食
			const idx = bird.target.index;
			if (idx != null && items[idx]) {
				const it = items[idx];
				const itemX = it.x, itemY = it.y; // 记录词条位置
				items.splice(idx, 1);
				if (it.correct) {
					STATE.score += 1; // 正确+1分
					STATE.correct += 1;
					STATE.correctCounter += 1; // 增加连续正确计数
					STATE.levelProgress += 1; // 进度+1
					bird.size = Math.min(bird.size + 1.5, 40);
					// 正确时的粒子特效（绿色）
					createParticles(bird.x, bird.y, '#16a34a', 15);
					// 在词条位置显示浮动文字
					createFloatingText(itemX, itemY, '✓ 正确！', '#16a34a');
					showToast('✓ 正确！', '#16a34a');
					maybeLevelUp();
				} else {
					STATE.score = Math.max(0, STATE.score - 1); // 错误-1分
					STATE.wrong += 1;
					STATE.levelProgress = Math.max(0, STATE.levelProgress - 1); // 进度-1，不能小于0
					// 错误词不重置计数器，保持9:1的严格比例
					bird.size = Math.max(bird.size - 1.5, 10);
					// 错误时的粒子特效（红色）
					createParticles(bird.x, bird.y, '#dc2626', 15);
					// 在词条位置显示浮动文字
					createFloatingText(itemX, itemY, '✗ ' + it.right, '#dc2626');
					showToast('✗ 错误！应为：' + it.right, '#dc2626');

					// 暂停游戏，显示错误提示（放大效果）
					showErrorPrompt(it.word, it.right, itemX, itemY);
				}
			}
			bird.target = null;
			bird.idleTimer = 0; // 重置空闲计时器
		} else {
			bird.x += (dx / dist) * spd;
			bird.y += (dy / dist) * spd;
		}
	} else {
		// 无目标：进入空闲模式，自由飞行
		bird.idleTimer++;

		// 空闲2秒后开始自由飞行
		if (bird.idleTimer > 120) {
			bird.idleMode = true;
			updateIdleFlight();
		}
	}

	// 道具 TTL
	const left = [];
	for (const it of items) {
		it.ttl -= 16;
		if (it.ttl > 0) left.push(it);
	}
	items = left;
}

// 显示错误提示（放大效果）
function showErrorPrompt(wrongWord, rightWord, x, y) {
	errorPrompt.active = true;
	errorPrompt.wrongWord = wrongWord;
	errorPrompt.rightWord = rightWord;
	errorPrompt.x = x;
	errorPrompt.y = y;
	errorPrompt.scale = 0;
	errorPrompt.timer = 0;
}

// 更新错误提示动画
function updateErrorPrompt() {
	if (!errorPrompt.active) return;

	errorPrompt.timer++;

	// 前20帧：放大动画 0 -> 1.5
	if (errorPrompt.timer <= 20) {
		errorPrompt.scale = (errorPrompt.timer / 20) * 1.5;
	}
	// 20-320帧：保持放大，轻微脉冲（5秒）
	else if (errorPrompt.timer <= 320) {
		const pulse = Math.sin((errorPrompt.timer - 20) * 0.1) * 0.05;
		errorPrompt.scale = 1.5 + pulse;
	}
	// 320-340帧：缩小消失
	else if (errorPrompt.timer <= 340) {
		errorPrompt.scale = 1.5 * (1 - (errorPrompt.timer - 320) / 20);
	}
	// 结束
	else {
		errorPrompt.active = false;
		errorPrompt.scale = 0;
	}
}

// 绘制错误提示
function drawErrorPrompt() {
	if (!errorPrompt.active || errorPrompt.scale <= 0) return;

	ctx.save();

	// 半透明背景遮罩
	ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// 提示框位置（居中）
	const boxX = canvas.width / 2;
	const boxY = canvas.height / 2;
	const boxWidth = 400 * errorPrompt.scale;
	const boxHeight = 200 * errorPrompt.scale;

	// 提示框背景（白色圆角矩形）
	ctx.fillStyle = '#fff';
	ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
	ctx.shadowBlur = 20 * errorPrompt.scale;
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 10 * errorPrompt.scale;
	roundRect(boxX - boxWidth / 2, boxY - boxHeight / 2, boxWidth, boxHeight, 20 * errorPrompt.scale);
	ctx.fill();

	ctx.shadowBlur = 0;
	ctx.shadowOffsetY = 0;

	// 错误图标（大红叉）
	ctx.strokeStyle = '#dc2626';
	ctx.lineWidth = 8 * errorPrompt.scale;
	ctx.lineCap = 'round';
	const iconSize = 40 * errorPrompt.scale;
	const iconY = boxY - boxHeight / 2 + 60 * errorPrompt.scale;
	ctx.beginPath();
	ctx.moveTo(boxX - iconSize, iconY - iconSize);
	ctx.lineTo(boxX + iconSize, iconY + iconSize);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(boxX + iconSize, iconY - iconSize);
	ctx.lineTo(boxX - iconSize, iconY + iconSize);
	ctx.stroke();

	// 错误的词（红色，删除线）
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `bold ${32 * errorPrompt.scale}px "Microsoft YaHei", SimHei, Arial`;
	ctx.fillStyle = '#dc2626';
	const wrongY = boxY - 10 * errorPrompt.scale;
	ctx.fillText(errorPrompt.wrongWord, boxX, wrongY);

	// 删除线
	ctx.strokeStyle = '#dc2626';
	ctx.lineWidth = 4 * errorPrompt.scale;
	const textWidth = ctx.measureText(errorPrompt.wrongWord).width;
	ctx.beginPath();
	ctx.moveTo(boxX - textWidth / 2 - 10, wrongY);
	ctx.lineTo(boxX + textWidth / 2 + 10, wrongY);
	ctx.stroke();

	// 箭头
	ctx.fillStyle = '#666';
	ctx.font = `${28 * errorPrompt.scale}px Arial`;
	ctx.fillText('↓', boxX, wrongY + 40 * errorPrompt.scale);

	// 正确的词（绿色）
	ctx.font = `bold ${36 * errorPrompt.scale}px "Microsoft YaHei", SimHei, Arial`;
	ctx.fillStyle = '#16a34a';
	ctx.fillText(errorPrompt.rightWord, boxX, wrongY + 75 * errorPrompt.scale);

	// 正确图标（绿色勾）
	ctx.strokeStyle = '#16a34a';
	ctx.lineWidth = 6 * errorPrompt.scale;
	ctx.beginPath();
	ctx.moveTo(boxX - 100 * errorPrompt.scale, wrongY + 75 * errorPrompt.scale);
	ctx.lineTo(boxX - 80 * errorPrompt.scale, wrongY + 90 * errorPrompt.scale);
	ctx.lineTo(boxX - 60 * errorPrompt.scale, wrongY + 60 * errorPrompt.scale);
	ctx.stroke();

	ctx.restore();
}

// 空闲飞行逻辑
function updateIdleFlight() {
	// 如果没有下一个目标点，或已经接近目标点，生成新的随机目标
	if (!bird.nextIdleTarget ||
		Math.hypot(bird.nextIdleTarget.x - bird.x, bird.nextIdleTarget.y - bird.y) < 30) {
		// 生成新的随机目标点（避开边缘）
		const margin = 80;
		bird.nextIdleTarget = {
			x: margin + Math.random() * (canvas.width - margin * 2),
			y: margin + Math.random() * (canvas.height - 200) // 避开地面
		};
	}

	// 朝向下一个目标点移动（速度较慢）
	const idleSpeed = 2 + Math.random() * 1.5; // 随机速度2-3.5
	const dx = bird.nextIdleTarget.x - bird.x;
	const dy = bird.nextIdleTarget.y - bird.y;
	const dist = Math.hypot(dx, dy);

	if (dist > 0) {
		// 添加一些随机波动，让运动更自然
		const wobble = Math.sin(Date.now() * 0.005) * 0.5;
		bird.x += (dx / dist) * idleSpeed + wobble;
		bird.y += (dy / dist) * idleSpeed + Math.cos(Date.now() * 0.003) * 0.3;

		// 边界检测（防止飞出屏幕）
		const margin = 50;
		if (bird.x < margin) bird.x = margin;
		if (bird.x > canvas.width - margin) bird.x = canvas.width - margin;
		if (bird.y < margin) bird.y = margin;
		if (bird.y > canvas.height - 150) bird.y = canvas.height - 150;
	}
}

function draw() {
	// 直接绘制背景（简化实现，避免缓存问题）
	drawBackground();

	drawItems();
	drawBird();

	// 低配模式下减少粒子效果（性能优化）
	if (!lowPowerMode || particles.length < 15) {
		drawParticles();
	}

	drawFloatingTexts();

	// 绘制错误提示（最上层）
	if (errorPrompt.active) {
		drawErrorPrompt();
	}

	updateUI();
}

function loop(ts) {
	if (!STATE.running) return;

	// 性能优化：动态调整帧率
	if (shouldSkipFrame(ts)) {
		animationId = requestAnimationFrame(loop);
		return;
	}

	update();
	draw();
	animationId = requestAnimationFrame(loop);

	// 性能监控：如果帧率过低，自动降低目标帧率
	if (ts - lastFrameAt > 20) { // 如果帧间隔超过20ms（<50fps）
		targetFPS = Math.max(TARGET_FPS_LOW, targetFPS - 5);
	} else if (targetFPS < TARGET_FPS_NORMAL && ts - lastFrameAt < 16) {
		// 如果性能恢复，逐步提高帧率
		targetFPS = Math.min(TARGET_FPS_NORMAL, targetFPS + 1);
	}
}

function startLoops() {
	clearInterval(spawnTimer);
	// 如果level为0，使用第1级（索引0）的值
	const levelIndex = STATE.level > 0 ? STATE.level - 1 : 0;
	const baseMs = LEVELS[levelIndex].spawnMs;
	const spawnMs = lowPowerMode ? Math.round(baseMs * 1.25) : baseMs;
	spawnTimer = setInterval(spawnItem, spawnMs);
	loop();
}

function maybeLevelUp() {
	// 新的升级系统：
	// 0级→1级：累计18分
	// 1级→2级：累计36分（重新计数）
	// 2级→3级：累计72分（重新计数）
	// 3级为最高级

	let shouldLevelUp = false;
	let targetLevel = STATE.level;

	if (STATE.level === 0 && STATE.levelProgress >= 18) {
		targetLevel = 1;
		shouldLevelUp = true;
		STATE.levelProgress = 0; // 重新计数
	} else if (STATE.level === 1 && STATE.levelProgress >= 36) {
		targetLevel = 2;
		shouldLevelUp = true;
		STATE.levelProgress = 0; // 重新计数
	} else if (STATE.level === 2 && STATE.levelProgress >= 72) {
		targetLevel = 3;
		shouldLevelUp = true;
		STATE.levelProgress = 72; // 保持72，表示已满
	}

	if (shouldLevelUp && targetLevel > STATE.level) {
		STATE.level = targetLevel;
		showToast('升级到 Lv.' + STATE.level + ' · 更快更准！', '#2563eb');
		if (STATE.level === 3) {
			showToast('🎉 恭喜达到最高级！解锁"知新"功能！', '#ffd700');
		}
		startLoops();
	}
}

function onClickCanvas(e) {
	if (!STATE.running || STATE.paused) return;
	const rect = canvas.getBoundingClientRect();

	// 计算缩放比例（Canvas实际显示大小 vs Canvas逻辑大小）
	const scaleX = canvas.width / rect.width;
	const scaleY = canvas.height / rect.height;

	// 根据缩放比例调整坐标
	const mx = (e.clientX - rect.left) * scaleX;
	const my = (e.clientY - rect.top) * scaleY;

	// 记录点击位置，用于树木摆动
	lastClickX = mx;

	// 让树木根据点击方向摆动
	for (const tree of trees) {
		const direction = mx < tree.x ? -1 : 1; // 点击在树左边还是右边
		const distance = Math.abs(mx - tree.x);
		const maxDistance = canvas.width / 2;
		const swayStrength = Math.max(0, 1 - distance / maxDistance) * 0.15; // 距离越近摆动越大
		tree.targetSway = direction * swayStrength;
	}

	// 找到点击点附近的第一条词（命中卡片区域）
	let hitIndex = -1;
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		if (mx >= it.x - it.w / 2 && mx <= it.x + it.w / 2 && my >= it.y - it.h / 2 && my <= it.y + it.h / 2) {
			hitIndex = i; break;
		}
	}
	if (hitIndex >= 0) {
		const it = items[hitIndex];
		bird.target = { x: it.x, y: it.y, index: hitIndex };
	} else {
		// 点击空白：飞向点击点但不吞食
		bird.target = { x: mx, y: my, index: null };
	}
}

function startGame() {
	if (STATE.running) return;
	STATE.running = true; STATE.paused = false;
	gameStartTime = Date.now(); // 记录游戏开始时间
	overlay.classList.add('hidden');
	startBtn.disabled = true; pauseBtn.disabled = false;

	// 播放背景音乐（如果已启用）
	if (bgMusic && musicEnabled) {
		bgMusic.play().catch(err => {
			console.log('背景音乐播放失败:', err);
		});
	}

	startLoops(); spawnItem(); spawnItem();
}

function pauseGame() {
	if (!STATE.running) return;
	STATE.paused = !STATE.paused;
	if (STATE.paused) {
		clearInterval(spawnTimer);
		// 暂停背景音乐
		if (bgMusic && musicEnabled) {
			bgMusic.pause();
		}
		showToast('已暂停 (P)', '#334155');
		pauseBtn.textContent = '继续';
	} else {
		startLoops();
		// 继续播放背景音乐（如果已启用）
		if (bgMusic && musicEnabled) {
			bgMusic.play().catch(err => {
				console.log('背景音乐播放失败:', err);
			});
		}
		pauseBtn.textContent = '暂停';
		showToast('继续', '#334155');
	}
}

function resetGame() {
	cancelAnimationFrame(animationId);
	clearInterval(spawnTimer);
	STATE.running = false; STATE.paused = false;
	startBtn.disabled = false; pauseBtn.disabled = true; pauseBtn.textContent = '暂停';
	bird.target = null; items = [];
	STATE.score = 0; STATE.level = 0; STATE.correct = 0; STATE.wrong = 0; STATE.levelProgress = 0; bird.size = 16; bird.x = 120; bird.y = canvas.height - 120;

	// 停止背景音乐
	if (bgMusic) {
		bgMusic.pause();
		bgMusic.currentTime = 0;
	}

	updateUI();
	overlay.classList.remove('hidden');
	draw();
}

function showToast(text, color) {
	toast.textContent = text; toast.style.background = color;
	toast.classList.remove('hidden');
	clearTimeout(showToast._t);
	showToast._t = setTimeout(() => toast.classList.add('hidden'), 1400);
}

function handleKey(e) {
	// Shift+W 切换词库管理按钮显示
	if (e.shiftKey && !e.ctrlKey && (e.key === 'w' || e.key === 'W')) {
		e.preventDefault();
		const wordBankButtons = document.getElementById('wordBankButtons');
		if (wordBankButtons) {
			const isVisible = wordBankButtons.style.display !== 'none';
			wordBankButtons.style.display = isVisible ? 'none' : 'flex';
			showToast(isVisible ? '词库管理已隐藏' : '词库管理已激活', isVisible ? '#6c757d' : '#16a34a');
		}
		return;
	}

	switch (e.key) {
		case 'p': case 'P': pauseGame(); break;
		case 'r': case 'R': resetGame(); break;
	}
}

// 音乐控制函数
function toggleMusic() {
	musicEnabled = !musicEnabled;
	if (musicEnabled) {
		musicBtn.textContent = '🔊';
		musicBtn.title = '关闭音乐';
		// 如果游戏正在运行且未暂停，播放音乐
		if (STATE.running && !STATE.paused && bgMusic) {
			bgMusic.play().catch(err => {
				console.log('背景音乐播放失败:', err);
			});
		}
		showToast('🔊 音乐已开启', '#16a34a');
	} else {
		musicBtn.textContent = '🔇';
		musicBtn.title = '开启音乐';
		// 停止音乐
		if (bgMusic) {
			bgMusic.pause();
		}
		showToast('🔇 音乐已关闭', '#dc2626');
	}
}

// 事件
canvas.addEventListener('click', onClickCanvas);

// 触摸事件处理（移动端）
let touchStartTime = 0;
let touchStartPos = null;

canvas.addEventListener('touchstart', (e) => {
	const touch = e.touches[0];
	touchStartTime = Date.now();
	touchStartPos = { x: touch.clientX, y: touch.clientY };
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
	// 如果是快速点击，触发点击事件
	const touchDuration = Date.now() - touchStartTime;
	if (touchDuration < 500 && touchStartPos) {
		const touch = e.changedTouches[0];
		const moveDistance = Math.hypot(touch.clientX - touchStartPos.x, touch.clientY - touchStartPos.y);

		// 如果移动距离很小，认为是点击
		if (moveDistance < 10) {
			const mouseEvent = new MouseEvent('click', {
				clientX: touch.clientX,
				clientY: touch.clientY,
				bubbles: true
			});
			onClickCanvas(mouseEvent);
		}
	}

	touchStartPos = null;
});

startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', pauseGame);
resetBtn.addEventListener('click', resetGame);
exitBtn.addEventListener('click', exitGame);
overlayStart.addEventListener('click', startGame);
musicBtn.addEventListener('click', toggleMusic);

// 知新按钮（3级解锁）
const zhixinBtn = document.getElementById('zhixinBtn');
if (zhixinBtn) {
	zhixinBtn.addEventListener('click', function () {
		// 获取当前路径并跳转到 /jy/index.html
		const currentPath = window.location.pathname;
		const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
		window.location.href = basePath + '/jy/index.html';
	});
}

window.addEventListener('keydown', handleKey);

// ========== 导入/清除词库功能 ==========
const importBtn = document.getElementById('importBtn');
const clearBtn = document.getElementById('clearBtn');
const importModal = document.getElementById('importModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const confirmBtn = document.getElementById('confirmBtn');
const wordInput = document.getElementById('wordInput');
const autoDistractor = document.getElementById('autoDistractor');
const errorRate = document.getElementById('errorRate');

let customWordBank = null; // 自定义词库

// 打开导入对话框
if (importBtn) {
	importBtn.addEventListener('click', () => {
		importModal.classList.remove('hidden');
		wordInput.focus();
	});
}

// 关闭对话框
function closeImportModal() {
	importModal.classList.add('hidden');
	wordInput.value = '';
}
if (closeModal) closeModal.addEventListener('click', closeImportModal);
if (cancelBtn) cancelBtn.addEventListener('click', closeImportModal);

// 从本地存储加载词库
function loadWordBankFromStorage() {
	try {
		const saved = localStorage.getItem('啄木鸟_自定义词库');
		if (saved) {
			customWordBank = JSON.parse(saved);
			// 替换sampleWord函数
			window.sampleWord = function (probWrong = 0.10, forceWrong = false) {
				const wrongs = customWordBank.filter(w => !w.correct);
				const rights = customWordBank.filter(w => w.correct);
				// 如果强制错误，直接返回错误词
				if (forceWrong && wrongs.length > 0) {
					const w = wrongs[Math.floor(Math.random() * wrongs.length)];
					return { text: w.word, correct: false, right: w.right };
				}
				// 否则按概率随机
				const useWrong = Math.random() < probWrong && wrongs.length > 0;
				if (useWrong) {
					const w = wrongs[Math.floor(Math.random() * wrongs.length)];
					return { text: w.word, correct: false, right: w.right };
				}
				const r = rights[Math.floor(Math.random() * rights.length)];
				return { text: r.word, correct: true };
			};
			const correctCount = customWordBank.filter(w => w.correct).length;
			const wrongCount = customWordBank.filter(w => !w.correct).length;
			console.log(`✅ 已加载自定义词库：正确词${correctCount}，干扰项${wrongCount}`);
			console.log(`📌 默认词库已暂停使用`);
			return true;
		}
	} catch (err) {
		console.error('加载词库失败:', err);
	}
	return false;
}

// 保存词库到本地存储
function saveWordBankToStorage(wordBank) {
	try {
		localStorage.setItem('啄木鸟_自定义词库', JSON.stringify(wordBank));
		console.log('词库已保存到本地存储');
		return true;
	} catch (err) {
		console.error('保存词库失败:', err);
		showToast('保存失败：存储空间不足', '#dc2626');
		return false;
	}
}

// 确认导入
if (confirmBtn) {
	confirmBtn.addEventListener('click', () => {
		const text = wordInput.value.trim();
		if (!text) {
			showToast('请输入词库内容', '#dc2626');
			return;
		}

		try {
			const lines = text.split('\n').map(l => l.trim()).filter(l => l);
			const correctWords = [];
			const distractors = [];

			// 解析输入
			for (const line of lines) {
				if (line.includes('/')) {
					const [wrong, right] = line.split('/').map(s => s.trim());
					distractors.push({ word: wrong, correct: false, right: right });
					if (!correctWords.find(w => w.word === right)) {
						correctWords.push({ word: right, correct: true });
					}
				} else {
					correctWords.push({ word: line, correct: true });
				}
			}

			// 自动生成干扰项
			if (autoDistractor.checked && correctWords.length > 0) {
				const rate = parseInt(errorRate.value) / 100;
				const confuse = {
					'朗': '郎', '郎': '朗', '蕴': '酝', '酝': '蕴', '序': '絮', '絮': '序',
					'青': '清', '清': '青', '旷': '犷', '犷': '旷', '脆': '悴', '悴': '脆',
					'省': '醒', '醒': '省', '悦': '说', '说': '悦', '罔': '惘', '惘': '罔',
					'殆': '怠', '怠': '殆', '优': '忧', '忧': '优', '造': '凿', '凿': '造',
					'岐': '歧', '歧': '岐', '尔': '而', '而': '尔', '新': '欣', '欣': '新'
				};
				const count = Math.ceil(correctWords.length * rate);
				for (let i = 0; i < count && i < correctWords.length; i++) {
					const word = correctWords[i].word;
					let wrong = null;
					for (let j = 0; j < word.length; j++) {
						if (confuse[word[j]]) {
							wrong = word.substring(0, j) + confuse[word[j]] + word.substring(j + 1);
							break;
						}
					}
					if (!wrong && word.length === 2) {
						wrong = word[1] + word[0];
					}
					if (wrong && !distractors.find(d => d.word === wrong)) {
						distractors.push({ word: wrong, correct: false, right: word });
					}
				}
			}

			// 合并并打乱
			customWordBank = [...correctWords, ...distractors];
			for (let i = customWordBank.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[customWordBank[i], customWordBank[j]] = [customWordBank[j], customWordBank[i]];
			}

			// 保存到本地存储
			saveWordBankToStorage(customWordBank);

			// 替换sampleWord函数
			window.sampleWord = function (probWrong = 0.10, forceWrong = false) {
				const wrongs = customWordBank.filter(w => !w.correct);
				const rights = customWordBank.filter(w => w.correct);
				// 如果强制错误，直接返回错误词
				if (forceWrong && wrongs.length > 0) {
					const w = wrongs[Math.floor(Math.random() * wrongs.length)];
					return { text: w.word, correct: false, right: w.right };
				}
				// 否则按概率随机
				const useWrong = Math.random() < probWrong && wrongs.length > 0;
				if (useWrong) {
					const w = wrongs[Math.floor(Math.random() * wrongs.length)];
					return { text: w.word, correct: false, right: w.right };
				}
				const r = rights[Math.floor(Math.random() * rights.length)];
				return { text: r.word, correct: true };
			};

			closeImportModal();
			resetGame();
			updateWordBankStatus(); // 更新状态显示
			showToast(`✅ 自定义词库已启用！（默认词库已暂停）\n正确词：${correctWords.length}，干扰项：${distractors.length}`, '#16a34a');
		} catch (err) {
			console.error(err);
			showToast('导入失败：' + err.message, '#dc2626');
		}
	});
}

// 清除词库
if (clearBtn) {
	clearBtn.addEventListener('click', () => {
		if (!customWordBank) {
			showToast('当前使用默认词库', '#f59e0b');
			return;
		}
		if (confirm('确定要清除自定义词库并恢复默认词库吗？\n（自定义词库将被删除）')) {
			customWordBank = null;
			// 从本地存储中删除
			localStorage.removeItem('啄木鸟_自定义词库');
			showToast('✅ 已恢复默认词库（自定义词库已暂停）\n即将刷新...', '#f59e0b');
			// 延迟刷新，让用户看到提示
			setTimeout(() => location.reload(), 1000);
		}
	});
}

// 更新词库状态显示
function updateWordBankStatus() {
	const statusEl = document.getElementById('wordBankStatus');
	if (!statusEl) return;

	if (customWordBank) {
		const correctCount = customWordBank.filter(w => w.correct).length;
		const wrongCount = customWordBank.filter(w => !w.correct).length;
		statusEl.textContent = `📚 自定义词库（${correctCount}词）`;
		statusEl.style.backgroundColor = '#dbeafe';
		statusEl.style.color = '#1e40af';
		statusEl.title = `自定义词库：${correctCount}个正确词，${wrongCount}个干扰项\n默认词库已暂停`;
	} else {
		statusEl.textContent = '📚 默认词库';
		statusEl.style.backgroundColor = '#fef3c7';
		statusEl.style.color = '#92400e';
		statusEl.title = '七年级期中词库（约300+词条）';
	}
}

// 页面加载时尝试从本地存储加载词库
const hasCustomWordBank = loadWordBankFromStorage();
if (hasCustomWordBank) {
	const correctCount = customWordBank.filter(w => w.correct).length;
	const wrongCount = customWordBank.filter(w => !w.correct).length;
	// 在游戏开始时提示用户当前使用的词库
	console.log(`✅ 使用自定义词库：${correctCount}个正确词，${wrongCount}个干扰项`);
	console.log(`📌 默认词库已暂停（七年级期中词库不会出现）`);

	// 在开始游戏时显示提示
	const originalStartGame = startGame;
	startGame = function () {
		if (hasCustomWordBank && !STATE.running) {
			showToast('📚 当前使用：自定义词库（默认词库已暂停）', '#2563eb');
		}
		originalStartGame.call(this);
	};
} else {
	console.log(`📚 使用默认词库：七年级期中版（约300+词条）`);

	// 在开始游戏时显示提示
	const originalStartGame = startGame;
	startGame = function () {
		if (!customWordBank && !STATE.running) {
			showToast('📚 当前使用：默认词库（七年级期中版）', '#2563eb');
		}
		originalStartGame.call(this);
	};
}

// 更新状态显示
updateWordBankStatus();

// ========== 启动螺旋动画 ==========
const splashScreen = document.getElementById('splashScreen');
const spiralCanvas = document.getElementById('spiralCanvas');
let spiralCtx = null;
let spiralAnimationId = null;
let spiralTime = 0;
let animationComplete = false;

// 初始化螺旋Canvas
function initSpiralCanvas() {
	if (!spiralCanvas) return;

	// 设置Canvas尺寸
	spiralCanvas.width = window.innerWidth;
	spiralCanvas.height = window.innerHeight;
	spiralCtx = spiralCanvas.getContext('2d');

	// 监听窗口大小变化
	window.addEventListener('resize', () => {
		spiralCanvas.width = window.innerWidth;
		spiralCanvas.height = window.innerHeight;
	});
}

// 绘制螺旋动画
function drawSpiral() {
	if (!spiralCtx || !spiralCanvas) return;

	const width = spiralCanvas.width;
	const height = spiralCanvas.height;
	const centerX = width / 2;
	const centerY = height / 2;

	// 清空画布
	spiralCtx.clearRect(0, 0, width, height);

	// 设置绘制样式
	const maxRadius = Math.min(width, height) * 0.4;
	const numSpirals = 3; // 螺旋数量
	const lineWidth = 3;

	spiralTime += 0.02; // 控制动画速度

	// 绘制多个螺旋
	for (let s = 0; s < numSpirals; s++) {
		const spiralOffset = (s / numSpirals) * Math.PI * 2;
		const hue = (spiralTime * 20 + s * 120) % 360;

		spiralCtx.strokeStyle = `hsl(${hue}, 70%, 60%)`;
		spiralCtx.lineWidth = lineWidth;
		spiralCtx.lineCap = 'round';
		spiralCtx.shadowBlur = 15;
		spiralCtx.shadowColor = `hsl(${hue}, 70%, 60%)`;

		spiralCtx.beginPath();

		// 绘制螺旋线
		const points = 200;
		for (let i = 0; i <= points; i++) {
			const t = i / points;
			const angle = t * Math.PI * 8 + spiralTime + spiralOffset; // 8圈螺旋
			const radius = t * maxRadius;

			const x = centerX + Math.cos(angle) * radius;
			const y = centerY + Math.sin(angle) * radius;

			if (i === 0) {
				spiralCtx.moveTo(x, y);
			} else {
				spiralCtx.lineTo(x, y);
			}
		}

		spiralCtx.stroke();
	}

	// 绘制中心光点
	const centerHue = (spiralTime * 30) % 360;
	spiralCtx.fillStyle = `hsl(${centerHue}, 80%, 70%)`;
	spiralCtx.shadowBlur = 30;
	spiralCtx.shadowColor = `hsl(${centerHue}, 80%, 70%)`;
	spiralCtx.beginPath();
	spiralCtx.arc(centerX, centerY, 8, 0, Math.PI * 2);
	spiralCtx.fill();

	// 绘制外圈粒子
	for (let i = 0; i < 20; i++) {
		const angle = (i / 20) * Math.PI * 2 + spiralTime * 2;
		const radius = maxRadius * 1.2;
		const x = centerX + Math.cos(angle) * radius;
		const y = centerY + Math.sin(angle) * radius;

		const particleHue = (spiralTime * 25 + i * 18) % 360;
		spiralCtx.fillStyle = `hsla(${particleHue}, 70%, 60%, 0.6)`;
		spiralCtx.shadowBlur = 10;
		spiralCtx.shadowColor = `hsl(${particleHue}, 70%, 60%)`;
		spiralCtx.beginPath();
		spiralCtx.arc(x, y, 4, 0, Math.PI * 2);
		spiralCtx.fill();
	}
}

// 启动动画循环
function startSpiralAnimation() {
	if (!spiralCtx) return;

	function animate() {
		if (animationComplete) return;

		drawSpiral();
		spiralAnimationId = requestAnimationFrame(animate);
	}

	animate();
}

// 结束启动动画
function endSplashScreen() {
	if (animationComplete) return;
	animationComplete = true;

	// 停止动画循环
	if (spiralAnimationId) {
		cancelAnimationFrame(spiralAnimationId);
	}

	// 淡出效果
	if (splashScreen) {
		splashScreen.classList.add('fade-out');

		// 动画结束后移除元素
		setTimeout(() => {
			if (splashScreen) {
				splashScreen.style.display = 'none';
			}
		}, 800);
	}
}

// 初始化启动动画
function initSplashScreen() {
	initSpiralCanvas();
	startSpiralAnimation();

	// 3秒后自动结束（或可以点击跳过）
	const autoEndTimer = setTimeout(() => {
		endSplashScreen();
	}, 3000);

	// 点击跳过
	if (splashScreen) {
		splashScreen.addEventListener('click', () => {
			clearTimeout(autoEndTimer);
			endSplashScreen();
		});
	}
}

// 页面加载完成后启动动画
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initSplashScreen);
} else {
	// DOM已经加载完成
	initSplashScreen();
}

// 初始
resetGame();
