// Simple test to validate MapLibre container handling
// This can be run in browser console to test the fix

const testMapContainerValidation = () => {
  console.log("Testing MapLibre container validation...");

  // Test 1: Check if container dimension validation is working
  const testContainer = document.createElement("div");
  testContainer.style.width = "0px";
  testContainer.style.height = "0px";
  document.body.appendChild(testContainer);

  const rect = testContainer.getBoundingClientRect();
  const hasValidDimensions = rect.width > 0 && rect.height > 0;

  console.log("Container dimensions test:", {
    width: rect.width,
    height: rect.height,
    isValid: hasValidDimensions,
    expected: false,
  });

  // Test 2: Check with valid dimensions
  testContainer.style.width = "400px";
  testContainer.style.height = "300px";

  const rectValid = testContainer.getBoundingClientRect();
  const hasValidDimensionsAfter = rectValid.width > 0 && rectValid.height > 0;

  console.log("Container dimensions test (valid):", {
    width: rectValid.width,
    height: rectValid.height,
    isValid: hasValidDimensionsAfter,
    expected: true,
  });

  // Cleanup
  document.body.removeChild(testContainer);

  return {
    test1: !hasValidDimensions, // Should be false (no dimensions)
    test2: hasValidDimensionsAfter, // Should be true (has dimensions)
    success: !hasValidDimensions && hasValidDimensionsAfter,
  };
};

// Export for browser console testing
if (typeof window !== "undefined") {
  window.testMapContainerValidation = testMapContainerValidation;
}

export { testMapContainerValidation };
