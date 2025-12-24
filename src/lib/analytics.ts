export const trackError = (category: string, message: string) => {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "app_error",
      error_details: {
        category,
        message: message.substring(0, 100),
        timestamp: new Date().toISOString(),
      }
    });
  }
};