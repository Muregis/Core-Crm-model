import React from 'react'

const MobileMenuOverlay = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
      onClick={onClose}
    />
  )
}

export default MobileMenuOverlay
