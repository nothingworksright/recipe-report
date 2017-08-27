#!/usr/bin/env node

'use strict'

/**
 * Email functions.
 * @author {@link https://github.com/jmg1138 jmg1138}
 */

/**
 * Modules that will be used.
 * @see {@link https://github.com/guileen/node-sendmail node-sendmail}
 */
const sendmail = require('sendmail')({
  silent: true
})

function looksOk (email) {
  return new Promise((resolve, reject) => {
    // A regular expression to do a quick sanity-check on a given email address.
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!regex.test(email)) {
      reject(new Error('Email address seems invalid.'))
    } else {
      resolve()
    }
  })
}
exports.looksOk = looksOk

function sendActivation (email, headers, token) {
  return new Promise((resolve, reject) =>
    emailHeadersTokenReceived(email, headers, token)
      .then(() => renderEmail(email, headers, token))
      .then(rendered => sendEmail(rendered.from, email, rendered.subject, rendered.text))
      .then(reply => resolve(reply))
      .catch(err => reject(err))
  )
}
exports.sendActivation = sendActivation

function emailHeadersTokenReceived (email, headers, token) {
  return new Promise((resolve, reject) => {
    if (
      email !== undefined &&
      headers !== undefined &&
      token !== undefined
    ) resolve()
    else reject(new Error(`Email address, headers, or token is missing. These are required to send an account activation email.`))
  })
}

function renderEmail (email, headers, token) {
  return new Promise(resolve => {
    const from = `no-reply@recipe.report`
    const subject = `Welcome to www.Recipe.Report - Activation is required`
    const text = `Hello ${email},\n\nThank you for registering with www.Recipe.Report recently. You may login after completing activation. Please follow this link to activate your new account: \n\nhttps://api.recipe.report/activate/${token} \n\nYou received this email because you (or someone else) used this email address to create a new account.\n\nRequest headers: ${JSON.stringify(headers, null, '\t')}\n\nThank you,\n\nhttp://www.Recipe.Report`
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'test'
      // Log local link to console for debugging
    ) console.log(`http://127.0.0.1:1138/activate/${token}`)
    resolve({
      from: from,
      subject: subject,
      text: text
    })
  })
}

function sendEmail (from, email, subject, text) {
  return new Promise((resolve, reject) => {
    if (process.env.NODE_ENV === 'production') {
      sendmail({
        from: from,
        to: email,
        subject: subject,
        text: text
      }, (err, reply) => {
        if (err) reject(err)
        resolve(reply)
      })
    } else { // Not production, do not send email.
      resolve({
        alert: `Email not sent: Not a production environment.`
      })
    }
  })
}