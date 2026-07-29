// Minimal, dependency-free markdown renderer: headers, bold, inline code, lists, paragraphs.
// Not a full CommonMark implementation — just enough for lightweight project docs.

function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${keyPrefix}-${i}`} className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-[13px] font-mono">{part.slice(1, -1)}</code>
    }
    return part
  })
}

export default function renderMarkdownLite(markdown) {
  const lines = (markdown || '').split('\n')
  const blocks = []
  let listItems = null

  const flushList = () => {
    if (listItems) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="list-disc pl-5 space-y-1 my-2">
          {listItems.map((item, i) => <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`)}</li>)}
        </ul>
      )
      listItems = null
    }
  }

  lines.forEach((line, i) => {
    const heading = line.match(/^(#{1,3})\s+(.*)/)
    const listItem = line.match(/^[-*]\s+(.*)/)

    if (heading) {
      flushList()
      const level = heading[1].length
      const sizes = { 1: 'text-xl font-semibold mt-4 mb-2', 2: 'text-lg font-semibold mt-3 mb-2', 3: 'text-base font-semibold mt-2 mb-1' }
      const Tag = `h${level}`
      blocks.push(<Tag key={i} className={sizes[level]}>{renderInline(heading[2], `h-${i}`)}</Tag>)
    } else if (listItem) {
      listItems = listItems || []
      listItems.push(listItem[1])
    } else if (line.trim() === '') {
      flushList()
    } else {
      flushList()
      blocks.push(<p key={i} className="leading-relaxed my-1.5">{renderInline(line, `p-${i}`)}</p>)
    }
  })
  flushList()

  return blocks
}
