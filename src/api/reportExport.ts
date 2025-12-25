import { getPaperStats, getPaperList, type PaperStats } from './admin'
import { getRanking, type RankingItem } from './ranking'
import { getExamResult } from './papers'
import { exportPaperAsHTML } from './export'

export interface ReportData {
  paperTitle: string
  paperId: string
  stats: PaperStats
  ranking: RankingItem[]
  dateRange?: {
    start: string
    end: string
  }
}

// 导出成绩报表为PDF
export async function exportReportAsPDF(paperId: string) {
  const stats = await getPaperStats(paperId)
  const ranking = await getRanking({ paper_id: paperId, limit: 100 })

  if (!stats) {
    throw new Error('无法获取统计数据')
  }

  const html = generateReportHTML({
    paperTitle: stats.paper_title,
    paperId,
    stats,
    ranking,
  })

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
        URL.revokeObjectURL(url)
      }, 1000)
    }, 500)
  }
}

// 导出成绩报表为CSV
export async function exportReportAsCSV(paperId: string) {
  const stats = await getPaperStats(paperId)
  const ranking = await getRanking({ paper_id: paperId, limit: 1000 })

  if (!stats) {
    throw new Error('无法获取统计数据')
  }

  const header = ['排名', '姓名', '得分', '总分', '正确率', '提交时间']
  const rows = ranking.map((item, index) => [
    (index + 1).toString(),
    item.user_name,
    item.score.toString(),
    item.total_score.toString(),
    `${(item.correct_rate * 100).toFixed(1)}%`,
    new Date(item.submitted_at).toLocaleString('zh-CN'),
  ])

  const csv = [
    [`试卷：${stats.paper_title}`],
    [`总提交数：${stats.total_submissions}`],
    [`平均分：${stats.average_score.toFixed(2)}`],
    [`最高分：${stats.highest_score.toFixed(2)}`],
    [`最低分：${stats.lowest_score.toFixed(2)}`],
    [`及格率：${(stats.pass_rate * 100).toFixed(1)}%`],
    [],
    header,
    ...rows,
  ]
    .map((row) => row.join(','))
    .join('\n')

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${stats.paper_title}_成绩报表.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// 生成报表HTML
function generateReportHTML(data: ReportData): string {
  const { paperTitle, stats, ranking } = data

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${paperTitle} - 成绩报表</title>
      <style>
        body {
          font-family: 'Microsoft YaHei', Arial, sans-serif;
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 15px;
          margin-bottom: 30px;
        }
        .stat-card {
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 5px;
          text-align: center;
        }
        .stat-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 5px;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          padding: 10px;
          text-align: left;
          border: 1px solid #ddd;
        }
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${paperTitle}</h1>
        <p>成绩统计报表</p>
        <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">总提交数</div>
          <div class="stat-value">${stats.total_submissions}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均分</div>
          <div class="stat-value">${stats.average_score.toFixed(1)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">最高分</div>
          <div class="stat-value">${stats.highest_score.toFixed(1)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">最低分</div>
          <div class="stat-value">${stats.lowest_score.toFixed(1)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">及格率</div>
          <div class="stat-value">${(stats.pass_rate * 100).toFixed(1)}%</div>
        </div>
      </div>

      <h2>成绩排名</h2>
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>姓名</th>
            <th>得分</th>
            <th>总分</th>
            <th>正确率</th>
            <th>提交时间</th>
          </tr>
        </thead>
        <tbody>
          ${ranking
            .map(
              (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.user_name}</td>
              <td>${item.score}</td>
              <td>${item.total_score}</td>
              <td>${(item.correct_rate * 100).toFixed(1)}%</td>
              <td>${new Date(item.submitted_at).toLocaleString('zh-CN')}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>青锋测 - 中小学在线考试平台</p>
      </div>
    </body>
    </html>
  `
}

// 导出学生个人成绩报表
export async function exportStudentReport(studentId: string, paperId?: string) {
  // 获取学生的所有成绩或指定试卷的成绩
  // 这里简化实现，实际应该从API获取
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>个人成绩报表</title>
      <style>
        body {
          font-family: 'Microsoft YaHei', Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          padding: 10px;
          text-align: left;
          border: 1px solid #ddd;
        }
        th {
          background-color: #f5f5f5;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>个人成绩报表</h1>
        <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
      </div>
      <p>个人成绩报表功能开发中...</p>
    </body>
    </html>
  `

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
        URL.revokeObjectURL(url)
      }, 1000)
    }, 500)
  }
}
