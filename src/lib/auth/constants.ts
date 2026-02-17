const isProd = process.env.NODE_ENV === 'production'

export const SESSION_COOKIE_NAME = isProd ? '__Host-biller_session' : 'biller_session'

