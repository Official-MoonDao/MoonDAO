"""
Claude API client with tool use support

Provides structured interaction with Claude for bug analysis,
code generation, and self-review.
"""

import base64
from pathlib import Path
from typing import List, Optional, Any, Dict
import structlog
from anthropic import Anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import Settings

logger = structlog.get_logger()


# Tool definitions for Claude
TOOLS = [
    {
        "name": "read_file",
        "description": "Read the contents of a file from the repository",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file relative to the repository root"
                }
            },
            "required": ["path"]
        }
    },
    {
        "name": "search_codebase",
        "description": "Search for patterns in the codebase using grep-like functionality",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search pattern (supports regex)"
                },
                "file_pattern": {
                    "type": "string",
                    "description": "File glob pattern to limit search (e.g., '*.tsx', 'components/**')"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "list_directory",
        "description": "List files and directories in a path",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the directory relative to repository root"
                }
            },
            "required": ["path"]
        }
    },
    {
        "name": "apply_fix",
        "description": "Apply a code fix by replacing content in a file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file to modify"
                },
                "old_content": {
                    "type": "string",
                    "description": "The exact content to replace"
                },
                "new_content": {
                    "type": "string",
                    "description": "The new content to insert"
                }
            },
            "required": ["path", "old_content", "new_content"]
        }
    },
]


class ClaudeClient:
    """Client for interacting with Claude API"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.claude_model
        self.max_tokens = settings.claude_max_tokens
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
    )
    async def analyze(
        self,
        system_prompt: str,
        user_message: str,
        images: Optional[List[bytes]] = None,
        use_tools: bool = False,
        tool_handler: Optional[callable] = None,
    ) -> str:
        """
        Send a message to Claude and get a response.
        
        Args:
            system_prompt: System prompt defining Claude's behavior
            user_message: The user message/question
            images: Optional list of image bytes to include
            use_tools: Whether to enable tool use
            tool_handler: Function to handle tool calls (async)
        
        Returns:
            Claude's response text
        """
        messages = []
        
        # Build user message content
        content = []
        
        # Add images if provided
        if images:
            for img_bytes in images:
                img_base64 = base64.standard_b64encode(img_bytes).decode("utf-8")
                content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": img_base64,
                    }
                })
        
        content.append({
            "type": "text",
            "text": user_message
        })
        
        messages.append({
            "role": "user",
            "content": content
        })
        
        # Make API call
        kwargs = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": system_prompt,
            "messages": messages,
        }
        
        if use_tools:
            kwargs["tools"] = TOOLS
        
        response = self.client.messages.create(**kwargs)
        
        # Handle tool use if needed
        if use_tools and response.stop_reason == "tool_use":
            return await self._handle_tool_use(
                response, messages, system_prompt, tool_handler
            )
        
        # Extract text response
        for block in response.content:
            if hasattr(block, "text"):
                return block.text
        
        return ""
    
    async def _handle_tool_use(
        self,
        response,
        messages: List[dict],
        system_prompt: str,
        tool_handler: Optional[callable],
    ) -> str:
        """Handle tool use responses from Claude"""
        max_iterations = 10
        iteration = 0
        
        while response.stop_reason == "tool_use" and iteration < max_iterations:
            iteration += 1
            
            # Add assistant message
            messages.append({
                "role": "assistant",
                "content": response.content
            })
            
            # Process tool calls
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    logger.info(
                        "tool_call",
                        tool=block.name,
                        input=block.input
                    )
                    
                    if tool_handler:
                        result = await tool_handler(block.name, block.input)
                    else:
                        result = f"Tool {block.name} not implemented"
                    
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(result)
                    })
            
            # Add tool results
            messages.append({
                "role": "user",
                "content": tool_results
            })
            
            # Continue conversation
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system_prompt,
                messages=messages,
                tools=TOOLS,
            )
        
        # Extract final text response
        for block in response.content:
            if hasattr(block, "text"):
                return block.text
        
        return ""
    
    async def generate_structured(
        self,
        system_prompt: str,
        user_message: str,
        output_schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate a structured JSON response from Claude.
        
        Args:
            system_prompt: System prompt
            user_message: User message
            output_schema: Expected JSON schema for the output
        
        Returns:
            Parsed JSON response
        """
        schema_prompt = f"""
{system_prompt}

You must respond with valid JSON matching this schema:
{output_schema}

Only output the JSON, no other text.
"""
        
        response = await self.analyze(schema_prompt, user_message)
        
        # Parse JSON from response
        import json
        try:
            # Try to extract JSON from response
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                return json.loads(response[json_start:json_end])
        except json.JSONDecodeError:
            logger.warning("failed_to_parse_json", response=response[:200])
        
        return {}
