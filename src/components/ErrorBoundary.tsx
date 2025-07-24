import React from "react";
import { Button } from "@/components/ui/button"; // Assuming you have a Button component

type ErrorBoundaryProps = { children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean };

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Error Boundary Caught:", error, errorInfo);
  }

  // --- NEW: A method to reset the error state ---
  handleTryAgain = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      // --- NEW: An improved fallback UI with a button ---
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-center p-4">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Oops! Something went wrong.</h2>
          <p className="text-gray-700 mb-6">
            We've logged the issue and will look into it. Please try again.
          </p>
          <Button onClick={this.handleTryAgain}>
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}