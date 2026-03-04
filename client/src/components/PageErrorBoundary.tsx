/**
 * PageErrorBoundary — Per-page error boundary with retry
 * Catches render errors in individual pages so the sidebar
 * and layout remain functional. Shows a recovery UI instead
 * of crashing the entire app.
 */

import React from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  fallbackPath?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class PageErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div className="text-center max-w-md">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Page failed to load
            </h2>
            <p className="text-sm text-muted-foreground mb-1">
              Something went wrong while rendering this page. You can try again
              or navigate to the dashboard.
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground/60 font-mono mt-2 break-all">
                {this.state.error.message?.slice(0, 200)}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
            <Button size="sm" onClick={this.handleGoHome}>
              <Home className="w-3.5 h-3.5 mr-1.5" />
              Dashboard
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
