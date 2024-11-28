(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.bs58=f()}})(function(){
  
  // Base58 implementation
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const ALPHABET_MAP = {}
  const BASE = ALPHABET.length
  const LEADER = ALPHABET.charAt(0)

  // pre-compute lookup table
  for (let z = 0; z < ALPHABET.length; z++) {
    const x = ALPHABET.charAt(z)
    if (ALPHABET_MAP[x] !== undefined) throw new TypeError(x + ' is ambiguous')
    ALPHABET_MAP[x] = z
  }

  function encode(source) {
    if (source.length === 0) return ''

    const digits = [0]
    for (let i = 0; i < source.length; ++i) {
      let carry = source[i]
      for (let j = 0; j < digits.length; ++j) {
        carry += digits[j] << 8
        digits[j] = carry % BASE
        carry = (carry / BASE) | 0
      }

      while (carry > 0) {
        digits.push(carry % BASE)
        carry = (carry / BASE) | 0
      }
    }

    let string = ''

    // deal with leading zeros
    for (let k = 0; source[k] === 0 && k < source.length - 1; ++k) {
      string += ALPHABET[0]
    }

    // convert digits to a string
    for (let q = digits.length - 1; q >= 0; --q) {
      string += ALPHABET[digits[q]]
    }

    return string
  }

  function decode(string) {
    if (string.length === 0) return new Uint8Array(0)

    const bytes = [0]
    for (let i = 0; i < string.length; i++) {
      const value = ALPHABET_MAP[string[i]]
      if (value === undefined) throw new Error('Non-base58 character')

      let carry = value
      for (let j = 0; j < bytes.length; ++j) {
        carry += bytes[j] * BASE
        bytes[j] = carry & 0xff
        carry >>= 8
      }

      while (carry > 0) {
        bytes.push(carry & 0xff)
        carry >>= 8
      }
    }

    // deal with leading zeros
    for (let k = 0; string[k] === LEADER && k < string.length - 1; ++k) {
      bytes.push(0)
    }

    return new Uint8Array(bytes.reverse())
  }

  return {
    encode: function(source) {
      if (source instanceof Uint8Array) {
        return encode(source)
      }
      return encode(new Uint8Array(source))
    },
    decode: function(string) {
      return decode(string)
    }
  }
}) 