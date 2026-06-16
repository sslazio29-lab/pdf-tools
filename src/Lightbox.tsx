import { useEffect, useState } from 'react'
import { renderPage } from './lib/renderThumbnails'

/** ライトボックスで表示する1ページの情報。 */
export type LightboxPage = {
  /** 1始まりの表示ページ番号 */
  pageNum: number
  /** 元PDFでの1始まりページ番号（再描画に使う） */
  srcPageNum: number
  /** 追加回転角（度・90の倍数）。編集ビューでの回転をプレビューに反映する */
  rotation?: number
  /** 高解像度描画の生成までの暫定表示に使うサムネイル dataURL */
  fallback: string
}

type Props = {
  /** 対象のPDFファイル（高解像度の再描画に使う） */
  file: File
  /** 表示対象のページ配列 */
  pages: LightboxPage[]
  /** 現在表示中の pages 内インデックス */
  index: number
  /** インデックス変更要求（ページ送り） */
  onIndexChange: (index: number) => void
  /** 閉じる要求 */
  onClose: () => void
}

/**
 * クリックされたページを全画面で拡大表示するライトボックス。
 * 表示中に対象ページを高解像度で再描画する（生成までは fallback を表示）。
 * 閉じる: 背景クリック / ✕ / ESC。ページ送り: ←→ ボタンとキーボード。
 */
function Lightbox({ file, pages, index, onIndexChange, onClose }: Props) {
  const current = pages[index]
  // 高解像度の描画結果を「どのページのものか」とセットで保持する。
  // これにより isRendering を派生で求められ、effect内で同期的にstateを
  // リセットせずに済む（cascading renders を避ける）。
  const [rendered, setRendered] = useState<{
    srcPageNum: number
    url: string
  } | null>(null)

  const isCurrent = rendered?.srcPageNum === current.srcPageNum
  const isRendering = !isCurrent
  const displaySrc = isCurrent ? rendered.url : current.fallback

  const hasPrev = index > 0
  const hasNext = index < pages.length - 1

  // 表示中のページを高解像度で再描画する。
  // index 変更のたびに走り、古い結果は破棄フラグで無視する。
  useEffect(() => {
    let cancelled = false
    renderPage(file, current.srcPageNum)
      .then((url) => {
        if (!cancelled) setRendered({ srcPageNum: current.srcPageNum, url })
      })
      .catch(() => {
        // 失敗時は fallback（サムネイル）のまま表示を続ける
      })
    return () => {
      cancelled = true
    }
  }, [file, current.srcPageNum])

  // キーボード操作: ESCで閉じる、←→でページ送り。
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && hasPrev) onIndexChange(index - 1)
      else if (e.key === 'ArrowRight' && hasNext) onIndexChange(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, hasPrev, hasNext, onIndexChange, onClose])

  const rotation = current.rotation ?? 0

  return (
    <div
      className="lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${current.pageNum}ページ目のプレビュー`}
      onClick={onClose}
    >
      <button
        type="button"
        className="lightbox-close"
        aria-label="閉じる"
        onClick={onClose}
      >
        ✕
      </button>

      {hasPrev && (
        <button
          type="button"
          className="lightbox-nav prev"
          aria-label="前のページ"
          onClick={(e) => {
            e.stopPropagation()
            onIndexChange(index - 1)
          }}
        >
          ‹
        </button>
      )}

      <div className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
        <img
          className="lightbox-img"
          src={displaySrc}
          alt={`${current.pageNum}ページ目`}
          style={{ transform: `rotate(${rotation}deg)` }}
        />
        <div className="lightbox-caption">
          {current.pageNum} / {pages.length}
          {isRendering && (
            <span className="lightbox-spinner">高画質を生成中…</span>
          )}
        </div>
      </div>

      {hasNext && (
        <button
          type="button"
          className="lightbox-nav next"
          aria-label="次のページ"
          onClick={(e) => {
            e.stopPropagation()
            onIndexChange(index + 1)
          }}
        >
          ›
        </button>
      )}
    </div>
  )
}

export default Lightbox
