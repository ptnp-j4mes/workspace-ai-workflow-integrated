'use client'

import { ToastContainer } from 'react-toastify'

// ============================================================
// Shared Toast Container — place once in layout
// ============================================================
// NOTE: react-toastify CSS is imported in globals.css AFTER Tailwind
// to ensure it isn't overridden by Tailwind v4's preflight reset.

export function ToastProvider() {
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={4000}
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
    />
  )
}
