import { useState } from 'react'
import MergeView from './MergeView'
import SplitView from './SplitView'
import EditView from './EditView'
import OCRView from './OCRView'
import './App.css'

type Tab = 'merge' | 'split' | 'edit' | 'ocr'

function App() {
  const [tab, setTab] = useState<Tab>('merge')

  return (
    <main className="app">
      <header className="app-header">
        <h1>PDF ツール</h1>
      </header>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'merge'}
          className={`tab${tab === 'merge' ? ' active' : ''}`}
          onClick={() => setTab('merge')}
        >
          結合
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'split'}
          className={`tab${tab === 'split' ? ' active' : ''}`}
          onClick={() => setTab('split')}
        >
          分割・抽出
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'edit'}
          className={`tab${tab === 'edit' ? ' active' : ''}`}
          onClick={() => setTab('edit')}
        >
          ページ編集
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ocr'}
          className={`tab${tab === 'ocr' ? ' active' : ''}`}
          onClick={() => setTab('ocr')}
        >
          OCR（文字認識）
        </button>
      </div>

      {tab === 'merge' && <MergeView />}
      {tab === 'split' && <SplitView />}
      {tab === 'edit' && <EditView />}
      {tab === 'ocr' && <OCRView />}
    </main>
  )
}

export default App
