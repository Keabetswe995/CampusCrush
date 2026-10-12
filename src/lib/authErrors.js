const EMAIL_SEND_LIMIT = /(?:email|mail).{0,40}(?:rate.?limit|limit exceeded|too many)|(?:rate.?limit|too many).{0,40}(?:email|mail)|over_email_send_rate_limit|over_request_rate_limit/i

export function authErrorMessage(error) {
  const message = error?.message || ''
  if (error?.status === 429 || EMAIL_SEND_LIMIT.test(message)) {
    return 'We could not send that email just now. Please wait a few minutes and try again. If the problem continues, contact support.'
  }
  return message || 'Something went wrong. Please try again.'
}
