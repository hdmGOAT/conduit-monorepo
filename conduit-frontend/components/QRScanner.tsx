'use client'

import React, { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface Html5QrcodePluginProps {
  fps?: number
  qrbox?: number | { width: number; height: number }
  disableFlip?: boolean
  onSuccess: (decodedText: string, decodedResult: unknown) => void
  onError: (error: unknown) => void
}

export default function Html5QrcodePlugin(props: Html5QrcodePluginProps) {
  const { fps = 10, qrbox = 250, disableFlip = false, onSuccess, onError } = props
  const elementId = 'html5-qr-code'
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isInitializingRef = useRef(false)
  const isStartedRef = useRef(false)

  useEffect(() => {
    const initScanner = async () => {
      // Prevent multiple initializations
      if (isInitializingRef.current || isStartedRef.current) return
      isInitializingRef.current = true

      try {
        const scanner = new Html5Qrcode(elementId)
        scannerRef.current = scanner

        const config: Record<string, unknown> = {
          fps,
          qrbox,
          disableFlip,
          aspectRatio: 1,
          videoConstraints: {
            facingMode: { ideal: 'environment' },
          },
        }

        await scanner.start(
          { facingMode: 'environment' },
          config,
          onSuccess,
          onError
        )
        
        isStartedRef.current = true
      } catch (error) {
        console.error('Failed to initialize scanner:', error)
      } finally {
        isInitializingRef.current = false
      }
    }

    initScanner()

    return () => {
      const scanner = scannerRef.current
      if (scanner && isStartedRef.current) {
        isStartedRef.current = false
        scanner
          .stop()
          .catch(() => {
            // Suppress stop errors - they happen on cleanup
          })
          .finally(() => {
            try {
              scanner.clear()
            } catch {
              // Suppress clear errors
            }
          })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div id={elementId} style={{ width: '100%', height: '100%' }} />
}
