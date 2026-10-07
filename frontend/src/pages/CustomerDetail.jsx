import React from 'react'
import { useParams } from 'react-router-dom'

const CustomerDetail = () => {
  const { id } = useParams()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Detail</h1>
        <p className="text-gray-600">Customer ID: {id}</p>
      </div>
      
      <div className="card">
        <div className="card-body">
          <p>Customer detail page coming soon...</p>
        </div>
      </div>
    </div>
  )
}

export default CustomerDetail
