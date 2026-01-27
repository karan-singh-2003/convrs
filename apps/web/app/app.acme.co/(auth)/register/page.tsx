import React, { Suspense } from 'react'
import RegisterPageClient from './page-client'

const RegisterPage = () => {
  return (
    <Suspense fallback={<div>Loading</div>}>
      <RegisterPageClient />
    </Suspense>
  )
}

export default RegisterPage
