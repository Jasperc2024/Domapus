import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { trackError } from "@/lib/analytics";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
    trackError("404_not_found", `Route: ${location.pathname}`);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>      
        <Link to="/" className="text-blue-500 hover:text-blue-700 underline">
          Return to Domapus
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
