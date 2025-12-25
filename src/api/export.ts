import { getPaperWithQuestions } from './papers'
import type { PaperWithQuestions } from '../types'

// 导出试卷为文本格式
export function exportPaperAsText(paper: PaperWithQuestions, includeAnswers: boolean = false): string {
  let text = `试卷：${paper.title}\n`
  if (paper.subject) text += `学科：${paper.subject}\n`
  if (paper.grade) text += `年级：${paper.grade}\n`
  text += `时长：${paper.duration_minutes} 分钟\n`
  text += `总分：${paper.total_score} 分\n\n`
  text += '='.repeat(50) + '\n\n'

  paper.questions.forEach((pq, index) => {
    const q = pq.question
    text += `${index + 1}. ${q.stem}\n`

    if (q.options && q.options.length > 0) {
      q.options.forEach((opt) => {
        text += `   ${opt.label}. ${opt.text}\n`
      })
    }

    if (includeAnswers) {
      text += `\n   答案：${q.answer.join(', ')}\n`
      if (q.analysis) {
        text += `   解析：${q.analysis}\n`
      }
    }

    text += `\n   分值：${pq.score} 分\n\n`
    text += '-'.repeat(50) + '\n\n'
  })

  return text
}

// 导出试卷为HTML格式（用于PDF导出）
export function exportPaperAsHTML(paper: PaperWithQuestions, includeAnswers: boolean = false): string {
  const typeLabels: Record<string, string> = {
    single: '单选题',
    multiple: '多选题',
    true_false: '判断题',
    fill: '填空题',
    short: '简答题',
  }

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${paper.title}</title>
      <style>
        body {
          font-family: 'Microsoft YaHei', Arial, sans-serif;
          max-width: 800px;
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
        .meta {
          margin: 10px 0;
          color: #666;
          font-size: 14px;
        }
        .question {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .question-number {
          font-weight: bold;
          color: #333;
          margin-bottom: 10px;
        }
        .question-stem {
          margin: 10px 0;
        }
        .options {
          margin: 10px 0;
          padding-left: 20px;
        }
        .option {
          margin: 5px 0;
        }
        .answer {
          margin-top: 10px;
          padding: 10px;
          background-color: #f0f0f0;
          border-radius: 3px;
        }
        .analysis {
          margin-top: 10px;
          padding: 10px;
          background-color: #e8f4f8;
          border-radius: 3px;
        }
        .score {
          color: #666;
          font-size: 12px;
          margin-top: 5px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${paper.title}</h1>
        <div class="meta">
          ${paper.subject ? `<span>学科：${paper.subject}</span> ` : ''}
          ${paper.grade ? `<span>年级：${paper.grade}</span> ` : ''}
          <span>时长：${paper.duration_minutes} 分钟</span>
          <span>总分：${paper.total_score} 分</span>
        </div>
      </div>
  `

  paper.questions.forEach((pq, index) => {
    const q = pq.question
    html += `
      <div class="question">
        <div class="question-number">
          第 ${index + 1} 题（${typeLabels[q.type] || q.type}，${pq.score} 分）
        </div>
        <div class="question-stem">${q.stem}</div>
    `

    if (q.options && q.options.length > 0) {
      html += '<div class="options">'
      q.options.forEach((opt) => {
        html += `<div class="option">${opt.label}. ${opt.text}</div>`
      })
      html += '</div>'
    }

    if (includeAnswers) {
      html += `
        <div class="answer">
          <strong>答案：</strong>${q.answer.join(', ')}
        </div>
      `
      if (q.analysis) {
        html += `
          <div class="analysis">
            <strong>解析：</strong>${q.analysis}
          </div>
        `
      }
    }

    html += '</div>'
  })

  html += `
      </body>
    </html>
  `

  return html
}

// 导出为PDF（使用浏览器打印功能）
export async function exportPaperAsPDF(paper: PaperWithQuestions, includeAnswers: boolean = false) {
  const html = exportPaperAsHTML(paper, includeAnswers)
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

// 导出为Word（使用HTML转Word的方式）
export function exportPaperAsWord(paper: PaperWithQuestions, includeAnswers: boolean = false) {
  const html = exportPaperAsHTML(paper, includeAnswers)
  const blob = new Blob(
    [
      '\ufeff', // BOM for UTF-8
      html,
    ],
    { type: 'application/msword' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${paper.title}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

// 导出为文本文件
export function exportPaperAsTextFile(paper: PaperWithQuestions, includeAnswers: boolean = false) {
  const text = exportPaperAsText(paper, includeAnswers)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${paper.title}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

