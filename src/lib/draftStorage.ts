// 本地草稿存储（IndexedDB）

const DB_NAME = 'exam_drafts'
const STORE_NAME = 'drafts'
const DB_VERSION = 1

let db: IDBDatabase | null = null

async function openDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'paperId' })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }
  })
}

export async function saveDraftLocal(paperId: string, answers: Record<string, string[] | string>) {
  try {
    const database = await openDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        paperId,
        answers,
        updatedAt: Date.now(),
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn('保存本地草稿失败', error)
  }
}

export async function loadDraftLocal(paperId: string): Promise<Record<string, string[] | string> | null> {
  try {
    const database = await openDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.get(paperId)
      request.onsuccess = () => {
        const data = request.result
        resolve(data?.answers || null)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn('加载本地草稿失败', error)
    return null
  }
}

export async function clearDraftLocal(paperId: string) {
  try {
    const database = await openDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(paperId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn('清除本地草稿失败', error)
  }
}




