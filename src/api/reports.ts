import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import { getExamResult } from './papers'
import type { PaperWithQuestions } from '../types'

export interface ReportFilter {
  userId?: string
  paperId?: string
  subject?: string
  grade?: string
  startDate?: string
  endDate?: string
  questionType?: string
}

export interface ReportData {
  paperId: string
  paperTitle: string
  subject: string | null
  grade: string | null
  totalScore: number
  userScore: number
  correctRate: number
  submittedAt: string
  questionStats: {
    type: string
    total: number
    correct: number
    score: number
    totalScore: number
  }[]
}

// 获取报表数据
export async function getReportData(filter: ReportFilter): Promise<ReportData[]> {
  if (!isSupabaseReady) {
    return []
  }

  let query = supabase
    .from('answers')
    .select(
      `
      paper_id,
      question_id,
      is_correct,
      score,
      manual_score,
      submitted_at,
      papers (
        id,
        title,
        subject,
        grade,
        total_score
      ),
      questions (
        id,
        type
      )
    `,
    )

  if (filter.userId) {
    query = query.eq('user_id', filter.userId)
  }

  if (filter.paperId) {
    query = query.eq('paper_id', filter.paperId)
  }

  if (filter.startDate) {
    query = query.gte('submitted_at', filter.startDate)
  }

  if (filter.endDate) {
    query = query.lte('submitted_at', filter.endDate)
  }

  const { data, error } = await query

  if (error) {
    console.warn('获取报表数据失败', error.message)
    return []
  }

  // 按试卷分组并计算统计
  const paperMap = new Map<string, ReportData>()

  data?.forEach((item: any) => {
    const paperId = item.paper_id
    const paper = item.papers
    const question = item.questions

    if (!paperMap.has(paperId)) {
      paperMap.set(paperId, {
        paperId,
        paperTitle: paper?.title || '未知试卷',
        subject: paper?.subject || null,
        grade: paper?.grade || null,
        totalScore: paper?.total_score || 0,
        userScore: 0,
        correctRate: 0,
        submittedAt: item.submitted_at,
        questionStats: [],
      })
    }

    const report = paperMap.get(paperId)!
    const score = (item.score || 0) + (item.manual_score || 0)
    report.userScore += score

    // 按题型统计
    const questionType = question?.type || 'unknown'
    let typeStat = report.questionStats.find((s) => s.type === questionType)
    if (!typeStat) {
      typeStat = {
        type: questionType,
        total: 0,
        correct: 0,
        score: 0,
        totalScore: 0,
      }
      report.questionStats.push(typeStat)
    }

    typeStat.total++
    typeStat.totalScore += score
    if (item.is_correct) {
      typeStat.correct++
      typeStat.score += score
    }
  })

  // 计算正确率
  paperMap.forEach((report) => {
    if (report.totalScore > 0) {
      report.correctRate = report.userScore / report.totalScore
    }
    report.questionStats.forEach((stat) => {
      if (stat.total > 0) {
        stat.score = stat.score / stat.total
      }
    })
  })

  // 应用筛选
  let reports = Array.from(paperMap.values())

  if (filter.subject) {
    reports = reports.filter((r) => r.subject === filter.subject)
  }

  if (filter.grade) {
    reports = reports.filter((r) => r.grade === filter.grade)
  }

  if (filter.questionType) {
    reports = reports.filter((r) =>
      r.questionStats.some((s) => s.type === filter.questionType),
    )
  }

  return reports.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
}

// 导出为PDF（使用浏览器打印）
export async function exportReportAsPDF(reports: ReportData[]): Promise<void> {
  const htmlContent = generateReportHTML(reports)
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('无法打开打印窗口，请检查浏览器设置')
  }

  printWindow.document.write(htmlContent)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

// 导出为CSV
export function exportReportAsCSV(reports: ReportData[]): void {
  const header = ['试卷标题', '学科', '年级', '总分', '得分', '正确率', '提交时间']
  const rows = reports.map((r) => [
    r.paperTitle,
    r.subject || 'N/A',
    r.grade || 'N/A',
    r.totalScore.toString(),
    r.userScore.toFixed(1),
    (r.correctRate * 100).toFixed(1) + '%',
    new Date(r.submittedAt).toLocaleString('zh-CN'),
  ])

  const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `成绩报表_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// 生成报表HTML（用于PDF导出）
function generateReportHTML(reports: ReportData[]): string {
  const typeLabels: Record<string, string> = {
    single: '单选',
    multiple: '多选',
    true_false: '判断',
    fill: '填空',
    short: '简答',
  }

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>成绩报表</title>
      <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; margin: 20px; }
        h1 { text-align: center; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .summary { margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
        .chart-placeholder { height: 200px; border: 1px dashed #ddd; display: flex; align-items: center; justify-content: center; color: #999; }
      </style>
    </head>
    <body>
      <h1>成绩报表</h1>
      <div class="summary">
        <p><strong>生成时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
        <p><strong>报表数量：</strong>${reports.length} 份</p>
      </div>
  `

  reports.forEach((report, index) => {
    html += `
      <h2>${index + 1}. ${report.paperTitle}</h2>
      <table>
        <tr>
          <th>学科</th>
          <th>年级</th>
          <th>总分</th>
          <th>得分</th>
          <th>正确率</th>
          <th>提交时间</th>
        </tr>
        <tr>
          <td>${report.subject || 'N/A'}</td>
          <td>${report.grade || 'N/A'}</td>
          <td>${report.totalScore}</td>
          <td>${report.userScore.toFixed(1)}</td>
          <td>${(report.correctRate * 100).toFixed(1)}%</td>
          <td>${new Date(report.submittedAt).toLocaleString('zh-CN')}</td>
        </tr>
      </table>
      
      <h3>题型统计</h3>
      <table>
        <tr>
          <th>题型</th>
          <th>题目数</th>
          <th>正确数</th>
          <th>得分</th>
          <th>正确率</th>
        </tr>
    `

    report.questionStats.forEach((stat) => {
      const correctRate = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0
      html += `
        <tr>
          <td>${typeLabels[stat.type] || stat.type}</td>
          <td>${stat.total}</td>
          <td>${stat.correct}</td>
          <td>${stat.score.toFixed(1)}</td>
          <td>${correctRate.toFixed(1)}%</td>
        </tr>
      `
    })

    html += `
      </table>
      <div style="page-break-after: always;"></div>
    `
  })

  html += `
    </body>
    </html>
  `

  return html
}
