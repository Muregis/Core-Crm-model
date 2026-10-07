/**
 * EmptyState.jsx
 * Reusable empty state for lists/tables with optional action.
 */
import React from 'react'

const EmptyState = ({ title, description, icon: Icon, actionLabel, onAction }) => {
  return (
    <div className="py-12 px-6 text-center">
      {Icon && (
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center dark:bg-primary-900/30 dark:text-primary-200">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{description}</p>
      )}
      {actionLabel && onAction && (
        <div className="mt-6">
          <button type="button" className="btn btn-primary" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  )
}

export default EmptyState

