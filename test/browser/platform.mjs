import React from 'react'
export const MarkdownText = ({ text }) => React.createElement('div', { 'data-md': '' }, text)
export const DisclosureRow = ({ children }) => children
export const TextShimmer = ({ children }) => children
export const IconThinkOutlineRegular = () => null
export const JsonBlock = () => null
export const createSnapshotStore = (v) => ({
  get: () => v,
  getSnapshot: () => v,
  subscribe: () => () => {}
})
