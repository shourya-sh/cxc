"""
Chat API — Gemini-powered NBA betting analyst
"""

from fastapi import APIRouter
from pydantic import BaseModel
from services.gemini import GeminiService

router = APIRouter()
gemini = GeminiService()


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    success: bool


@router.post("/", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Ask the AI analyst a question about NBA games, predictions, or betting."""
    if not req.message.strip():
        return ChatResponse(response="Please ask me something about NBA games!", success=False)

    response = await gemini.chat(req.message.strip())
    return ChatResponse(response=response, success=True)
