'use client'

interface ChatMessage {
  from: 'user' | 'yarro'
  text: string
}

export function WhatsAppPreview({
  messages,
  label,
}: {
  messages: ChatMessage[]
  label?: string
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-border">
      {/* Header bar */}
      <div className="bg-[#075e54] dark:bg-[#1f2c34] px-3 py-2 flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-[#25D366] flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">Y</span>
        </div>
        <span className="text-white text-xs font-medium">Yarro</span>
      </div>

      {/* Chat area */}
      <div className="bg-[#e5ddd5] dark:bg-[#0b141a] p-3 space-y-1.5">
        {label && (
          <p className="text-[10px] text-center text-black/40 dark:text-white/30 mb-2">
            {label}
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.from === 'yarro' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed whitespace-pre-line ${
                msg.from === 'yarro'
                  ? 'bg-white dark:bg-[#1f2c34] text-gray-900 dark:text-gray-100'
                  : 'bg-[#dcf8c6] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
