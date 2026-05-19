// ARCHITECTURAL RISK TEST FILE
// This file is designed to trigger the Brutal CTO's deep scan.

const SECRET_KEY = "demo_hardcoded_secret_value_12345"; // CRITICAL: Hardcoded Secret

function processData(input) {
  try {
    console.log("Processing production data..."); // LOW: Production console.log
    // HIGH: Missing catch block
  } finally {
    console.log("Cleanup.");
  }
}

// MEDIUM: Complexity (if we added 500 lines here)
for (let i = 0; i < 100; i++) {
    // Simulate some logic
}

processData("test");
