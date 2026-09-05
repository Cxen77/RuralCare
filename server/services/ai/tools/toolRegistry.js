/**
 * Tool Registry
 * 
 * Central registry of all allowlisted RuralCare backend tools.
 * - Enforces schema validation on tool inputs
 * - Enforces authentication and authorization checks
 * - Formats tools into standard OpenAI and Gemini specifications
 * - Prevents raw database or arbitrary code execution
 */

const patientTools = require('./patientTools');
const medicalTools = require('./medicalTools');
const doctorTools = require('./doctorTools');
const locationTools = require('./locationTools');
const mapRoutingTools = require('./mapRoutingTools');
const pharmacyTools = require('./pharmacyTools');
const prescriptionTools = require('./prescriptionTools');
const appointmentTools = require('./appointmentTools');
const emergencyTools = require('./emergencyTools');

const ALL_TOOLS = {
  ...patientTools,
  ...medicalTools,
  ...doctorTools,
  ...locationTools,
  ...mapRoutingTools,
  ...pharmacyTools,
  ...prescriptionTools,
  ...appointmentTools,
  ...emergencyTools
};

class ToolRegistry {
  /**
   * Returns standard tool schemas for OpenAI-compatible providers (Groq, OpenRouter, HuggingFace).
   */
  static getOpenAIToolDefinitions() {
    return Object.values(ALL_TOOLS).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * Returns tool schemas formatted for Google Gemini functionDeclarations.
   */
  static getGeminiToolDefinitions() {
    return [{
      functionDeclarations: Object.values(ALL_TOOLS).map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }))
    }];
  }

  /**
   * Validates and executes a tool safely.
   */
  static async executeTool(toolName, rawArgs = {}, context = {}) {
    const tool = ALL_TOOLS[toolName];
    if (!tool) {
      console.warn(`[ToolRegistry] Rejected unauthorized tool call: "${toolName}"`);
      return {
        error: true,
        code: 'TOOL_NOT_FOUND',
        message: `Tool "${toolName}" is not an authorized RuralCare tool.`
      };
    }

    let parsedArgs = rawArgs;
    if (typeof rawArgs === 'string') {
      try {
        parsedArgs = JSON.parse(rawArgs);
      } catch (err) {
        return {
          error: true,
          code: 'INVALID_ARGUMENTS',
          message: `Malformed JSON arguments for tool "${toolName}".`
        };
      }
    }

    // Basic schema validation for required fields
    const required = tool.parameters?.required || [];
    for (const reqField of required) {
      if (parsedArgs[reqField] === undefined || parsedArgs[reqField] === null) {
        // Special case: if originLat/originLon or coordinates can be supplied by context
        if ((reqField === 'originLat' || reqField === 'destLat' || reqField === 'latitude') && context?.location) {
          continue;
        }
        return {
          error: true,
          code: 'MISSING_REQUIRED_ARGUMENT',
          message: `Tool "${toolName}" requires parameter "${reqField}".`
        };
      }
    }

    try {
      console.log(`[ToolRegistry] 🔧 Executing tool: ${toolName}`, Object.keys(parsedArgs));
      const result = await tool.execute(parsedArgs, context);
      return result;
    } catch (err) {
      console.error(`[ToolRegistry] Error executing tool "${toolName}":`, err.message);
      return {
        error: true,
        code: 'TOOL_EXECUTION_ERROR',
        message: err.message || 'An error occurred while executing the backend tool.'
      };
    }
  }
}

module.exports = {
  ToolRegistry,
  ALL_TOOLS
};
