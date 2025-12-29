import React from 'react'
import { Button } from './ui/button'

interface State {
  hasError: boolean
  error?: Error | null
  showDetails?: boolean
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null, showDetails: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console for now; could send to telemetry
    console.error('Uncaught error in component tree', error, info)
  }

  copyError = async () => {
    const text = `${this.state.error?.message}\n\n${this.state.error?.stack}`
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy error to clipboard', err)
    }
  }

  toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }))
  }

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV !== 'production'
      return (
        <div className="p-8">
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4">An unexpected error occurred. Please try again.</p>

          {isDev && this.state.error && (
            <div className="mb-4">
              <div className="text-sm mb-2 font-medium">Error: {this.state.error.message}</div>
              <Button variant="outline" size="sm" onClick={this.toggleDetails} className="mr-2">
                {this.state.showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
              <Button variant="secondary" size="sm" onClick={this.copyError}>
                Copy Error
              </Button>
              {this.state.showDetails && (
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">{this.state.error.stack}</pre>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => location.reload()}>Reload</Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
