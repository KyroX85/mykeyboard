function protectExecutionRoot() {
  return {
    protectedRoot: 'MyKeyboard/ai-cto',
    packageJsonPaths: 'LOCKED_UNCHANGED',
    workflowPaths: 'LOCKED_UNCHANGED',
    whatsappPaths: 'LOCKED_UNCHANGED',
    androidRuntimePaths: 'LOCKED_UNCHANGED',
    relocationAllowed: false
  };
}

module.exports = { protectExecutionRoot };
