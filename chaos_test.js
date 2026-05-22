// ARCHITECTURAL RISK TEST FILE
// This file is designed to trigger the Brutal CTO's deep scan.

const demoCredentialLabel = "demo_" + "credential_" + "placeholder";

function processData(input) {
  try {
    console.log("Processing production data..."); // LOW: Production console.log
  } catch (error) {
    throw error;
  } finally {
    console.log("Cleanup.");
  }
}

// MEDIUM: Complexity (if we added 500 lines here)
for (let i = 0; i < 100; i++) {
    // Simulate some logic
}

processData("test");
