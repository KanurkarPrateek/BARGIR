'use client'
import React from 'react'
type Props = {
  children: React.ReactNode
}

const layout = ({ children }: Props) => {
  if (typeof window !== 'undefined') {
    const member_id = localStorage.getItem('member_id')
    if (member_id == '' || member_id == null) {
      window.location.href = '/login'
      return
    } else {
      return (
        <div>
          {children}
        </div>
      )
    }
  }
}

export default layout