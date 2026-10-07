import { useMemo, useState } from 'react'
import type { ConversionKind, ConversionUnit } from '../types/converter.types'
import { conversionOptions, convertValue } from '../utils/conversions'

export function useConverter() {
  const [kind, setKind] = useState<ConversionKind>('currency')
  const [amount, setAmount] = useState<number | ''>(25)
  const [from, setFrom] = useState<ConversionUnit>('USD')
  const [to, setTo] = useState<ConversionUnit>('EUR')
  const options = conversionOptions[kind]
  const result = useMemo(() => convertValue(kind, Number(amount) || 0, from, to), [kind, amount, from, to])
  const isValid = amount !== ''
  const changeKind = (next: ConversionKind) => {
    const nextOptions = conversionOptions[next]
    setKind(next); setFrom(nextOptions[0].code); setTo(nextOptions[1].code)
  }
  const swap = () => { setFrom(to); setTo(from) }
  return { kind, amount, from, to, options, result, isValid, setAmount, setFrom, setTo, changeKind, swap }
}
