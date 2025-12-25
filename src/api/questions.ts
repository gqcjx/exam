import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import type { QuestionItem, QuestionsFilter, QuestionType } from '../types'
import mammoth from 'mammoth'

/**
 * 根据系统时间推断当前学期
 * 通常：9月-次年1月是上学期，2月-8月是下学期
 */
function getCurrentSemester(): string {
  const now = new Date()
  const month = now.getMonth() + 1 // 0-11 -> 1-12
  // 9月-1月（次年）为上学期，2月-8月为下学期
  if (month >= 9 || month <= 1) {
    return '上学期'
  } else {
    return '下学期'
  }
}

/**
 * 生成随机难度（1-5之间）
 */
function getRandomDifficulty(): number {
  return Math.floor(Math.random() * 5) + 1
}

const mockQuestions: QuestionItem[] = [
  {
    id: 'mock-1',
    subject: '数学',
    grade: '七年级',
    difficulty: 2,
    type: 'single',
    stem: '下列哪一项是质数？',
    options: [
      { label: 'A', text: '21' },
      { label: 'B', text: '23' },
      { label: 'C', text: '25' },
      { label: 'D', text: '27' },
    ],
    answer: ['B'],
    analysis: '23 是质数，其余可分解质因数。',
    tags: ['数论'],
  },
  {
    id: 'mock-2',
    subject: '数学',
    grade: '七年级',
    difficulty: 3,
    type: 'multiple',
    stem: '关于等腰三角形，哪些说法正确？',
    options: [
      { label: 'A', text: '两腰相等' },
      { label: 'B', text: '顶角平分线垂直平分底边' },
      { label: 'C', text: '底角相等' },
      { label: 'D', text: '三边都相等' },
    ],
    answer: ['A', 'B', 'C'],
    analysis: '等腰仅两腰相等，顶角平分线垂直平分底边。',
    tags: ['几何'],
  },
  {
    id: 'mock-3',
    subject: '科学',
    grade: '七年级',
    difficulty: 1,
    type: 'true_false',
    stem: '地球绕太阳公转一周约 365.24 天。',
    answer: ['T'],
    analysis: '恒星年约 365.256 日，近似 365.24 天。',
    tags: ['天文'],
  },
]

export async function listQuestions(filter: QuestionsFilter = {}): Promise<QuestionItem[]> {
  if (!isSupabaseReady) {
    return mockQuestions
  }

  let query = supabase.from('questions').select(`
    id, subject, grade, semester, textbook_version, difficulty, type, stem, options, answer, analysis, tags, created_by
  `)

  if (filter.subject) query = query.eq('subject', filter.subject)
  if (filter.grade) query = query.eq('grade', filter.grade)
  if (filter.type) query = query.eq('type', filter.type)
  if (filter.difficulty) query = query.eq('difficulty', filter.difficulty)
  if (filter.search) query = query.ilike('stem', `%${filter.search}%`)

  const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
  if (error) {
    console.warn('获取题库失败，返回示例数据', error.message)
    return mockQuestions
  }
  return (data as QuestionItem[]) ?? []
}

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('CSV 内容为空')
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows = lines.slice(1).map((line) => line.split(','))

  return rows.map((cols) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? ''
    })
    return obj
  })
}

/**
 * 解析 Word 文档中的题目
 * 参考 mcq 项目的解析方法，支持同一行中的多个选项
 * 支持的格式：
 * 1. 题目编号：1、/ 1. / 1) / 第1题（优先识别 1、格式）
 * 2. 题干：题目编号后的内容直到选项或答案
 * 3. 选项：A. / A、/ A) / A：开头（支持同一行中的多个选项，如：A. 选项A B. 选项B C. 选项C D. 选项D）
 * 4. 答案：【答案】A 或 答案：A（蓝色【答案】标记后的内容）
 * 5. 解析：【解析】内容（蓝色【解析】标记后至下一题之间的内容）
 * 6. 元数据：学科：数学 / 年级：七年级 / 难度：2 / 标签：几何,代数
 */
async function parseWordDocument(file: File): Promise<any[]> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  const text = result.value

  if (!text || text.trim().length === 0) {
    throw new Error('Word 文档内容为空')
  }

  // 规范化文本：统一换行符
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // 从文档开头提取全局元数据（年级、科目、学期、教材版本）
  // 通常在文档前几行或标题中
  const lines = normalizedText.split('\n')
  let globalSubject: string | null = null
  let globalGrade: string | null = null
  let globalSemester: string | null = null
  let globalTextbookVersion: string | null = null

  // 检查前20行，提取元数据
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim()
    
    // 提取学科/科目
    const subjectMatch = line.match(/(?:学科|科目|课程)[：:]\s*(.+)/)
    if (subjectMatch && !globalSubject) {
      globalSubject = subjectMatch[1].trim()
    }
    
    // 提取年级
    const gradeMatch = line.match(/(?:年级|学段)[：:]\s*(.+)/)
    if (gradeMatch && !globalGrade) {
      globalGrade = gradeMatch[1].trim()
    }
    
    // 提取学期（上学期/下学期）
    const semesterMatch = line.match(/(?:学期)[：:]\s*(上|下)学期/)
    if (semesterMatch && !globalSemester) {
      globalSemester = semesterMatch[1] === '上' ? '上学期' : '下学期'
    }
    
    // 提取教材版本（人教版、苏教版、北师大版等）
    const versionMatch = line.match(/(?:版本|教材版本|教材)[：:]\s*(.+?)(?:版|版本)?/)
    if (versionMatch && !globalTextbookVersion) {
      let version = versionMatch[1].trim()
      // 如果版本名不包含"版"，自动添加
      if (!version.endsWith('版')) {
        version += '版'
      }
      globalTextbookVersion = version
    }
    
    // 也支持在标题中直接匹配（如：七年级上学期语文人教版）
    if (!globalGrade) {
      const gradeInTitle = line.match(/([一二三四五六七八九十]+年级|七年级|八年级|九年级|高一|高二|高三)/)
      if (gradeInTitle) {
        globalGrade = gradeInTitle[1]
      }
    }
    
    if (!globalSemester) {
      if (line.includes('上学期')) {
        globalSemester = '上学期'
      } else if (line.includes('下学期')) {
        globalSemester = '下学期'
      }
    }
    
    if (!globalSubject) {
      const subjectInTitle = line.match(/(数学|语文|英语|物理|化学|科学|历史|地理|生物|政治)/)
      if (subjectInTitle) {
        globalSubject = subjectInTitle[1]
      }
    }
    
    if (!globalTextbookVersion) {
      const versionInTitle = line.match(/(人教版|苏教版|北师大版|浙教版|沪教版|鲁教版|冀教版|湘教版|外研版|译林版)/)
      if (versionInTitle) {
        globalTextbookVersion = versionInTitle[1]
      }
    }
  }
  
  // 按题目编号分割文本块（支持 1、/ 1. / 1) / 1）格式）
  // 只识别阿拉伯数字开头的题号，排除中文数字（一、二、三等）和标题行
  // 使用正向前瞻，确保题号是独立的（前面是换行或行首，后面是分隔符）
  const blocks = normalizedText.split(/(?=\n\s*\d+[\.、．）)]|^\d+[\.、．）)])/).filter((b) => b.trim())

  const questions: any[] = []

  for (const block of blocks) {
    if (!block.trim()) continue

    // 答案和解析分隔符
    const ansDelim = /【?答案】?[:：\s]*/
    const anaDelim = /【?(?:解析|分析|解答|详解)】?[:：\s]*/

    let body = block
    let answerPart = ''
    let analysisPart = ''

    // 按答案和解析标识符动态切割块内容
    const ansMatch = block.match(ansDelim)
    if (ansMatch && ansMatch.index !== undefined) {
      body = block.substring(0, ansMatch.index)
      const rest = block.substring(ansMatch.index + ansMatch[0].length)
      const anaMatch = rest.match(anaDelim)
      if (anaMatch && anaMatch.index !== undefined) {
        answerPart = rest.substring(0, anaMatch.index)
        analysisPart = rest.substring(anaMatch.index + anaMatch[0].length)
      } else {
        answerPart = rest
      }
    } else {
      const anaOnlyMatch = block.match(anaDelim)
      if (anaOnlyMatch && anaOnlyMatch.index !== undefined) {
        body = block.substring(0, anaOnlyMatch.index)
        analysisPart = block.substring(anaOnlyMatch.index + anaOnlyMatch[0].length)
      }
    }

    // 检查是否是标题行（包含"大题"、"共"、"分"等关键词，或中文数字开头）
    // 标题行特征：一、单选题、本大题、共XX小题、共XX分等
    const titlePattern = /(?:^[一二三四五六七八九十]+[、\.]|大题|共\s*\d+\s*(?:小题|分)|本大题)/
    if (titlePattern.test(block.trim())) {
      continue // 跳过标题行
    }

    // 提取题干（主体中第一个选项之前的部分）
    const firstOptIdx = body.search(/[A-H][\.．、\s]/)
    let stem = (firstOptIdx !== -1 ? body.substring(0, firstOptIdx) : body)
      .trim()

    // 去除题干开头的题号（阿拉伯数字 + 分隔符，如：1、1.、1)等）
    // 确保只匹配阿拉伯数字开头的题号，不匹配中文数字
    stem = stem.replace(/^\d+[\.、．）)]\s*/, '').trim()

    // 去除题干中的题型标记：[单选]、[多选]、[判断]、[填空]、[简答]等
    stem = stem.replace(/^\[(?:单选|多选|判断|填空|简答|选择题|判断题|填空题|简答题)\]?\s*/, '').trim()

    // 再次检查去除题号和标记后的题干是否为空或仍是标题行
    if (!stem || titlePattern.test(stem)) {
      continue
    }

    // 提取选项（仅从主体部分提取，使用正则匹配同一行中的多个选项）
    const options: Array<{ label: string; text: string }> = []
    if (firstOptIdx !== -1) {
      const optionsText = body.substring(firstOptIdx)
      // 使用正则表达式匹配选项：A. 内容 B. 内容 C. 内容 D. 内容
      // 支持 A. / A、/ A) / A：格式
      // 使用非贪婪匹配和前瞻断言，确保正确分割选项
      const optRegex = /([A-H])[\.．、）:：\s]([\s\S]+?)(?=[A-H][\.．、）:：\s]|$)/g
      let m
      while ((m = optRegex.exec(optionsText)) !== null) {
        const label = m[1].toUpperCase()
        const text = m[2].trim()
        if (text) {
          options.push({ label, text })
        }
      }
    }

    // 提取答案
    let answer: string[] = []
    if (answerPart) {
      // 提取答案字母（A, B, C, D 等）
      const answerLetters = answerPart.match(/[A-H]/gi)
      if (answerLetters && answerLetters.length > 0) {
        answer = answerLetters.map((a) => a.toUpperCase())
      } else {
        // 如果不是字母，可能是文字答案（填空题或简答题）
        const answerText = answerPart.trim()
        if (answerText) {
          answer = [answerText]
        }
      }
    }

    // 提取解析，去除标记文字（【解析】、【分析】、【解答】、【详解】等）
    let analysis = analysisPart.trim() || null
    if (analysis) {
      // 去除所有可能的标记文字：【解析】、【分析】、【解答】、【详解】等
      // 支持多种格式：【解析】、解析：、分析：、解答：等
      analysis = analysis
        .replace(/^【?(?:解析|分析|解答|详解)】?[:：\s]*/g, '') // 去除开头的标记
        .replace(/【?(?:解析|分析|解答|详解)】?[:：\s]*/g, '') // 去除文本中所有出现的标记
        .trim()
      // 如果去除标记后为空，设为 null
      if (!analysis) {
        analysis = null
      }
    }

    // 确定题型
    let type: QuestionType = 'single'
    if (options.length === 0) {
      // 没有选项，可能是填空题或简答题
      if (stem.includes('____') || stem.includes('______') || stem.includes('（　　）')) {
        type = 'fill'
      } else {
        type = 'short'
      }
    } else if (options.length === 2 && (options[0].label === 'T' || options[0].label === 'F')) {
      type = 'true_false'
    } else if (answer.length > 1) {
      type = 'multiple'
    } else {
      type = 'single'
    }

    // 从题目块中提取局部元数据（如果有，会覆盖全局元数据）
    let localSubject: string | null = null
    let localGrade: string | null = null
    let localSemester: string | null = null
    let localTextbookVersion: string | null = null
    
    const subjectMatch = block.match(/(?:学科|科目)[：:]\s*(.+)/)
    if (subjectMatch) {
      localSubject = subjectMatch[1].trim()
    }
    
    const gradeMatch = block.match(/(?:年级|学段)[：:]\s*(.+)/)
    if (gradeMatch) {
      localGrade = gradeMatch[1].trim()
    }
    
    const semesterMatch = block.match(/(?:学期)[：:]\s*(上|下)学期/)
    if (semesterMatch) {
      localSemester = semesterMatch[1] === '上' ? '上学期' : '下学期'
    }
    
    const versionMatch = block.match(/(?:版本|教材版本|教材)[：:]\s*(.+?)(?:版|版本)?/)
    if (versionMatch) {
      let version = versionMatch[1].trim()
      if (!version.endsWith('版')) {
        version += '版'
      }
      localTextbookVersion = version
    }

    // 构建题目对象，优先使用局部元数据，否则使用全局元数据
    // 如果未设置难度，使用随机难度
    // 如果未设置教材版本，默认为"人教版"
    // 如果未设置学期，使用当前学期
    const question: any = {
      stem,
      options: options.length > 0 ? options : null,
      answer: answer.length > 0 ? answer : [],
      analysis,
      subject: localSubject || globalSubject || '未分类',
      grade: localGrade || globalGrade || null,
      semester: localSemester || globalSemester || getCurrentSemester(),
      textbook_version: localTextbookVersion || globalTextbookVersion || '人教版',
      difficulty: getRandomDifficulty(),
      tags: [],
      type,
    }

    questions.push(normalizeQuestion(question))
  }

  // 如果使用块解析方式没有解析到题目，回退到逐行解析方式
  if (questions.length === 0) {
    return parseWordDocumentLineByLine(text)
  }

  return questions
}

/**
 * 逐行解析 Word 文档（备用方法）
 */
function parseWordDocumentLineByLine(text: string): any[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0)
  const questions: any[] = []
  let currentQuestion: any = null
  let currentSection: 'stem' | 'options' | 'answer' | 'analysis' | 'metadata' = 'stem'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 检测题目开始（编号格式：优先识别 1、格式，然后是 1. / 1) / 第1题）
    // 只识别阿拉伯数字开头的题号，排除中文数字和标题行
    const questionMatch = line.match(/^(?:第)?(\d+)[、\.）)]\s*(.+)$/)
    if (questionMatch) {
      // 检查是否是标题行（包含"大题"、"共"、"分"等关键词，或中文数字开头）
      const titlePattern = /(?:^[一二三四五六七八九十]+[、\.]|大题|共\s*\d+\s*(?:小题|分)|本大题)/
      const stemText = questionMatch[2].trim()
      
      // 如果是标题行，跳过
      if (titlePattern.test(line) || titlePattern.test(stemText)) {
        continue
      }

      // 保存上一题
      if (currentQuestion && currentQuestion.stem) {
        questions.push(normalizeQuestion(currentQuestion))
      }
      
      // 开始新题目，去除题干中的题型标记
      let cleanStemText = stemText
      cleanStemText = cleanStemText.replace(/^\[(?:单选|多选|判断|填空|简答|选择题|判断题|填空题|简答题)\]?\s*/, '').trim()
      
      // 再次检查去除标记后的题干是否为空或仍是标题行
      if (!cleanStemText || titlePattern.test(cleanStemText)) {
        continue
      }
      
      currentQuestion = {
        stem: cleanStemText,
        options: [],
        answer: [],
        analysis: null,
        subject: '未分类',
        grade: null,
        semester: getCurrentSemester(),
        textbook_version: '人教版',
        difficulty: getRandomDifficulty(),
        tags: [],
        type: 'single' as QuestionType,
      }
      currentSection = 'stem'
      continue
    }

    // 检测选项（A. / A、/ A) / A：，优先识别 A. 和 A、格式）
    const optionMatch = line.match(/^([A-Z])[\.、）:：]\s*(.+)$/)
    if (optionMatch && currentQuestion) {
      // 如果当前在解析状态，说明已经进入下一题，不应该添加选项
      if (currentSection === 'analysis') {
        // 这可能是下一题的选项，但题目编号还没识别到，先跳过
        continue
      }
      currentQuestion.options.push({
        label: optionMatch[1],
        text: optionMatch[2],
      })
      currentSection = 'options'
      // 如果是选择题，更新类型
      if (currentQuestion.options.length === 2) {
        currentQuestion.type = 'single'
      } else if (currentQuestion.options.length > 2) {
        currentQuestion.type = 'multiple'
      }
      continue
    }

    // 检测判断题（正确/错误 / 对/错 / T/F）
    const trueFalseMatch = line.match(/^(正确|错误|对|错|T|F|True|False)[\.、：:]\s*(.+)$/i)
    if (trueFalseMatch && currentQuestion && !currentQuestion.options.length) {
      currentQuestion.type = 'true_false'
      currentQuestion.options = [
        { label: 'T', text: '正确' },
        { label: 'F', text: '错误' },
      ]
      currentQuestion.stem = currentQuestion.stem + ' ' + trueFalseMatch[2]
      continue
    }

    // 检测答案：【答案】A 或 答案：A（优先识别【答案】格式）
    const answerMatchBrackets = line.match(/^【答案】\s*(.+)$/)
    if (answerMatchBrackets && currentQuestion) {
      const answerText = answerMatchBrackets[1].trim()
      // 提取答案字母（A, B, C, D 等）
      const answers = answerText
        .match(/[A-Z]/g)
        ?.map((a) => a.toUpperCase())
        .filter((a) => a.length > 0) || []
      if (answers.length > 0) {
        currentQuestion.answer = answers
      } else {
        // 如果不是字母，可能是文字答案（填空题或简答题）
        currentQuestion.answer = [answerText]
      }
      currentSection = 'answer'
      continue
    }

    // 检测答案（其他格式：答案：A / 正确答案：A,B）
    const answerMatch = line.match(/^(?:答案|正确答案|答案：|正确答案：)[：:]\s*(.+)$/i)
    if (answerMatch && currentQuestion && currentSection !== 'analysis') {
      const answerText = answerMatch[1].trim()
      // 提取答案字母（A, B, C, D 等）
      const answers = answerText
        .split(/[，,、\s]+/)
        .map((a) => a.trim().toUpperCase())
        .filter((a) => a.length > 0 && /^[A-Z]$/.test(a))
      if (answers.length > 0) {
        currentQuestion.answer = answers
      } else {
        // 如果不是字母，可能是文字答案
        currentQuestion.answer = [answerText]
      }
      currentSection = 'answer'
      continue
    }

    // 检测判断题答案
    const tfAnswerMatch = line.match(/^(?:【答案】|答案|正确答案)[：:]\s*(正确|错误|对|错|T|F|True|False)$/i)
    if (tfAnswerMatch && currentQuestion && currentQuestion.type === 'true_false') {
      const ans = tfAnswerMatch[1].toUpperCase()
      currentQuestion.answer = ans.startsWith('T') || ans === '正确' || ans === '对' ? ['T'] : ['F']
      currentSection = 'answer'
      continue
    }

    // 检测解析：【解析】内容（优先识别【解析】格式）
    const analysisMatchBrackets = line.match(/^【(?:解析|分析|解答|详解)】\s*(.+)$/)
    if (analysisMatchBrackets && currentQuestion) {
      // 已经通过正则提取了标记后的内容，去除可能的额外标记
      let analysisText = analysisMatchBrackets[1].trim()
      // 再次去除可能残留的标记文字（防止嵌套标记）
      analysisText = analysisText.replace(/^【?(?:解析|分析|解答|详解)】?[:：\s]*/g, '').trim()
      currentQuestion.analysis = analysisText || null
      currentSection = 'analysis'
      continue
    }

    // 检测解析（其他格式：解析：内容 / 分析：内容 / 解答：内容）
    const analysisMatch = line.match(/^(?:解析|分析|解答|详解|解析：|分析：|解答：|详解：)[：:]?\s*(.+)$/)
    if (analysisMatch && currentQuestion) {
      // 已经通过正则提取了标记后的内容，去除可能的额外标记
      let analysisText = analysisMatch[1].trim()
      // 再次去除可能残留的标记文字（防止嵌套标记）
      analysisText = analysisText.replace(/^【?(?:解析|分析|解答|详解)】?[:：\s]*/g, '').trim()
      currentQuestion.analysis = analysisText || null
      currentSection = 'analysis'
      continue
    }

    // 检测元数据（学科、年级、难度、标签）
    const subjectMatch = line.match(/^(?:学科|科目)[：:]\s*(.+)$/)
    if (subjectMatch && currentQuestion) {
      currentQuestion.subject = subjectMatch[1].trim()
      continue
    }

    const gradeMatch = line.match(/^(?:年级|学段)[：:]\s*(.+)$/)
    if (gradeMatch && currentQuestion) {
      currentQuestion.grade = gradeMatch[1].trim()
      continue
    }

    const semesterMatch = line.match(/^(?:学期)[：:]\s*(上|下)学期/)
    if (semesterMatch && currentQuestion) {
      currentQuestion.semester = semesterMatch[1] === '上' ? '上学期' : '下学期'
      continue
    }

    const versionMatch = line.match(/^(?:版本|教材版本|教材)[：:]\s*(.+?)(?:版|版本)?/)
    if (versionMatch && currentQuestion) {
      let version = versionMatch[1].trim()
      if (!version.endsWith('版')) {
        version += '版'
      }
      currentQuestion.textbook_version = version
      continue
    }

    const difficultyMatch = line.match(/^(?:难度)[：:]\s*(\d+)$/)
    if (difficultyMatch && currentQuestion) {
      const parsedDifficulty = parseInt(difficultyMatch[1], 10)
      currentQuestion.difficulty = (parsedDifficulty >= 1 && parsedDifficulty <= 5) ? parsedDifficulty : getRandomDifficulty()
      continue
    }

    const tagsMatch = line.match(/^(?:标签|标签：)[：:]?\s*(.+)$/)
    if (tagsMatch && currentQuestion) {
      currentQuestion.tags = tagsMatch[1]
        .split(/[，,、\s]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
      continue
    }

    // 如果没有匹配到任何模式，根据当前状态追加内容
    if (currentQuestion) {
      if (currentSection === 'stem' && !currentQuestion.options.length) {
        // 继续题干
        currentQuestion.stem += ' ' + line
      } else if (currentSection === 'analysis') {
        // 继续解析（从【解析】后到下一题之间的所有内容）
        // 去除可能包含的标记文字
        let cleanLine = line.replace(/【?(?:解析|分析|解答|详解)】?[:：\s]*/g, '').trim()
        if (cleanLine) {
          if (currentQuestion.analysis) {
            currentQuestion.analysis += ' ' + cleanLine
          } else {
            currentQuestion.analysis = cleanLine
          }
        }
      } else if (currentSection === 'options' && currentQuestion.options.length > 0) {
        // 可能是选项的续行
        const lastOption = currentQuestion.options[currentQuestion.options.length - 1]
        lastOption.text += ' ' + line
      } else if (currentSection === 'answer' && !currentQuestion.answer.length) {
        // 答案可能是多行文字（填空题或简答题）
        if (currentQuestion.answer.length === 0) {
          currentQuestion.answer = [line]
        } else {
          currentQuestion.answer[0] += ' ' + line
        }
      }
    }
  }

  // 保存最后一题
  if (currentQuestion && currentQuestion.stem) {
    questions.push(normalizeQuestion(currentQuestion))
  }

  if (questions.length === 0) {
    throw new Error(
      '未能解析到题目。请确保 Word 文档格式正确：\n' +
        '1. 题目以编号开头（如：1. / 1、/ 1) / 第1题）\n' +
        '2. 选项以 A. / A、/ A) / A：开头\n' +
        '3. 答案格式：答案：A 或 正确答案：A,B\n' +
        '4. 解析格式：解析：内容\n' +
        '5. 可选元数据：学科：数学 / 年级：七年级 / 难度：2 / 标签：几何,代数'
    )
  }

  return questions
}

/**
 * 规范化题目数据，确保符合 Edge Function 的要求
 */
function normalizeQuestion(q: any): any {
  // 如果没有选项，可能是填空题或简答题
  if (!q.options || q.options.length === 0) {
    if (q.type === 'true_false') {
      // 判断题已有选项，保持不变
    } else if (q.stem.includes('____') || q.stem.includes('______')) {
      q.type = 'fill'
    } else {
      q.type = 'short'
    }
  }

  // 确保答案不为空
  if (!q.answer || q.answer.length === 0) {
    // 如果没有答案，尝试从选项中推断（仅用于示例，实际应要求提供答案）
    if (q.options && q.options.length > 0) {
      q.answer = [q.options[0].label]
    } else {
      q.answer = []
    }
  }

  // 确保选项格式正确
  if (q.options && q.options.length > 0) {
    q.options = q.options.map((opt: any, idx: number) => ({
      label: opt.label || String.fromCharCode(65 + idx),
      text: opt.text || '',
    }))
  } else if (q.type !== 'fill' && q.type !== 'short') {
    q.options = null
  }

  return {
    subject: q.subject || '未分类',
    grade: q.grade || null,
    semester: q.semester || getCurrentSemester(),
    textbook_version: q.textbook_version || '人教版',
    type: q.type || 'single',
    stem: q.stem.trim(),
    options: q.options && q.options.length > 0 ? q.options : null,
    answer: q.answer,
    analysis: q.analysis || null,
    difficulty: q.difficulty || getRandomDifficulty(),
    tags: q.tags || [],
  }
}

export async function importQuestionsFromFile(file: File) {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法导入题库')
  }

  // 检查用户是否已登录
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('请先登录后再导入题库')
  }

  const ext = file.name.toLowerCase()
  let payload: unknown

  // 支持 JSON / CSV / Word
  if (ext.endsWith('.json')) {
    const text = await file.text()
    try {
      payload = JSON.parse(text)
    } catch (e) {
      throw new Error('JSON 文件格式错误')
    }
  } else if (ext.endsWith('.csv')) {
    const text = await file.text()
    const rows = parseCsv(text)
    // 将 CSV 行转换为 Edge Function 所需的题目结构
    payload = rows.map((row) => ({
      subject: row.subject || '未分类',
      grade: row.grade || null,
      type: row.type || 'single',
      stem: row.stem || '',
      options: row.options
        ? row.options.split('|').map((opt, idx) => ({
            label: String.fromCharCode(65 + idx),
            text: opt.trim(),
          }))
        : null,
      answer: row.answer ? row.answer.split('|').map((a) => a.trim()) : [],
      analysis: row.analysis || null,
      difficulty: row.difficulty ? Number(row.difficulty) : 1,
      tags: row.tags ? row.tags.split('|').map((t) => t.trim()) : [],
    }))
  } else if (ext.endsWith('.docx') || ext.endsWith('.doc')) {
    // 解析 Word 文档
    try {
      payload = await parseWordDocument(file)
    } catch (e: any) {
      throw new Error(e?.message || 'Word 文档解析失败')
    }
  } else {
    throw new Error('仅支持 JSON、CSV 或 Word (.docx) 文件')
  }

  // 确保 payload 是数组
  if (!Array.isArray(payload)) {
    payload = Array.isArray((payload as any)?.questions) ? (payload as any).questions : [payload]
  }

  // 调用 Edge Function，Supabase 客户端会自动包含认证 token
  const { data, error } = await supabase.functions.invoke('import-questions', {
    body: payload as any,
  })

  if (error) {
    // 如果是 401 错误，提供更友好的提示
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      throw new Error('认证失败，请重新登录后再试')
    }
    throw new Error(error.message || '导入失败')
  }

  return data
}

export async function createQuestion(question: {
  subject: string
  grade?: string | null
  semester?: string | null
  textbook_version?: string | null
  type: QuestionType
  stem: string
  options?: Array<{ label: string; text: string }> | null
  answer: string[]
  analysis?: string | null
  difficulty?: number
  tags?: string[]
}): Promise<QuestionItem> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法创建题目')
  }

  const { data, error } = await supabase
    .from('questions')
    .insert({
      subject: question.subject,
      grade: question.grade || null,
      semester: question.semester || null,
      textbook_version: question.textbook_version || null,
      type: question.type,
      stem: question.stem,
      options: question.options || null,
      answer: question.answer,
      analysis: question.analysis || null,
      difficulty: question.difficulty || 1,
      tags: question.tags || [],
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as QuestionItem
}

export async function updateQuestion(
  id: string,
  question: {
    subject?: string
    grade?: string | null
    semester?: string | null
    textbook_version?: string | null
    type?: QuestionType
    stem?: string
    options?: Array<{ label: string; text: string }> | null
    answer?: string[]
    analysis?: string | null
    difficulty?: number
    tags?: string[]
  },
): Promise<QuestionItem> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法更新题目')
  }

  const { data, error } = await supabase
    .from('questions')
    .update(question)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as QuestionItem
}

export async function deleteQuestion(id: string) {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法删除题目')
  }

  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteQuestions(ids: string[]) {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法批量删除题目')
  }

  if (ids.length === 0) {
    throw new Error('请选择要删除的题目')
  }

  const { error } = await supabase.from('questions').delete().in('id', ids)
  if (error) {
    throw new Error(error.message)
  }
}


