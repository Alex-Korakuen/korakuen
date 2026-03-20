'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { addEntityTag, removeEntityTag } from '@/lib/actions'
import { useClickOutside } from '@/lib/use-click-outside'
import { tagColor } from './helpers'
import type { EntityTagItem } from '@/lib/types'

type Props = {
  entityId: string
  currentTags: EntityTagItem[]
  availableTags: { id: string; name: string }[]
}

export function EntityTagsDropdown({ entityId, currentTags, availableTags }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useClickOutside(dropdownRef, useCallback(() => setOpen(false), []))

  const assignedTagIds = new Set(currentTags.map(t => t.tagId))

  function handleToggle(tagId: string) {
    const isAssigned = assignedTagIds.has(tagId)
    startTransition(async () => {
      if (isAssigned) {
        await removeEntityTag(entityId, tagId)
      } else {
        await addEntityTag(entityId, tagId)
      }
    })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current tags + edit button */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {currentTags.map((tag) => (
          <span
            key={tag.tagId}
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(tag.name)}`}
          >
            {tag.name}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-600"
        >
          {currentTags.length === 0 ? '+ Add tags' : 'Edit'}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          <div className="max-h-60 overflow-y-auto">
            {availableTags.map((tag) => {
              const checked = assignedTagIds.has(tag.id)
              return (
                <label
                  key={tag.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 transition-colors hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isPending}
                    onChange={() => handleToggle(tag.id)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(tag.name)}`}
                  >
                    {tag.name}
                  </span>
                </label>
              )
            })}
          </div>
          {isPending && (
            <div className="border-t border-zinc-100 px-3 py-1.5 text-xs text-zinc-400">
              Saving...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
