from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/stories", tags=["stories"])


class CreateStoryRequest(BaseModel):
    uploadId: str


class GenerateAudioRequest(BaseModel):
    speed: Optional[float] = 1.0
    voice: Optional[str] = None


@router.get("/{story_id}", response_model=None)
async def get_story(
    story_id: str,
):
    """Get story by ID from Supabase"""
    try:
        # Use Supabase client to fetch story
        from ...utils.config import get_settings
        
        settings = get_settings()
        
        # Import supabase client
        from supabase import create_client, Client
        
        supabase: Client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key
        )
        
        # Query the stories table
        response = supabase.table("stories").select("*").eq("id", story_id).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Story with id {story_id} not found"
            )
        
        story_data = response.data[0]
        
        # Map content_type values - convert STORY to TEXT as fallback
        content_type_raw = story_data.get("content_type")
        if content_type_raw:
            content_type_upper = content_type_raw.upper()
            # Map STORY to TEXT, or use the value if it's valid
            if content_type_upper == "STORY":
                content_type = "TEXT"
            elif content_type_upper in ["TEXT", "COMIC", "NEWS"]:
                content_type = content_type_upper
            else:
                content_type = "TEXT"  # Default fallback
        else:
            content_type = "TEXT"
        
        # Handle visibility - map is_public boolean to visibility enum
        is_public = story_data.get("is_public", True)
        visibility = "PUBLIC" if is_public else "PRIVATE"
        
        # Transform snake_case to camelCase and normalize values
        transformed = {
            "id": story_data.get("id"),
            "uploadId": story_data.get("upload_id", ""),
            "title": story_data.get("title", ""),
            "content": story_data.get("content", ""),
            "audioUrl": story_data.get("audio_url"),
            "status": story_data.get("status", "draft").upper(),
            "views": story_data.get("views", 0),
            "createdAt": story_data.get("created_at", ""),
            "updatedAt": story_data.get("updated_at", ""),
            "contentType": content_type,
            "visibility": visibility,
        }
        
        return transformed
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch story: {str(e)}"
        )


@router.post("", response_model=None)
async def create_story(request: CreateStoryRequest):
    """Create a new story from upload"""
    try:
        from ...utils.config import get_settings
        from supabase import create_client, Client
        
        settings = get_settings()
        supabase: Client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key  # Use service role for server operations
        )
        
        # First, get the upload data
        upload_response = supabase.table("uploads").select("*").eq("id", request.uploadId).execute()
        
        if not upload_response.data or len(upload_response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Upload with id {request.uploadId} not found"
            )
        
        upload_data = upload_response.data[0]
        
        # Map visibility to is_public boolean
        visibility = upload_data.get("visibility", "PUBLIC")
        is_public = visibility.upper() == "PUBLIC"
        
        # Create story from upload data
        story_insert = {
            "upload_id": request.uploadId,
            "title": upload_data.get("title", ""),
            "description": upload_data.get("description"),
            "content": upload_data.get("extracted_text", ""),
            "author_id": upload_data.get("user_id"),
            "content_type": upload_data.get("content_type", "TEXT"),
            "is_public": is_public,
            "status": "PUBLISHED"  # Mark as published when creating story
        }
        
        response = supabase.table("stories").insert(story_insert).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create story"
            )
        
        story_data = response.data[0]
        
        # Map content_type values - convert STORY to TEXT as fallback
        content_type_raw = story_data.get("content_type")
        if content_type_raw:
            content_type_upper = content_type_raw.upper()
            if content_type_upper == "STORY":
                content_type = "TEXT"
            elif content_type_upper in ["TEXT", "COMIC", "NEWS"]:
                content_type = content_type_upper
            else:
                content_type = "TEXT"
        else:
            content_type = "TEXT"
        
        # Handle visibility - map is_public boolean to visibility enum
        is_public = story_data.get("is_public", True)
        visibility = "PUBLIC" if is_public else "PRIVATE"
        
        # Transform to camelCase
        transformed = {
            "id": story_data.get("id"),
            "uploadId": story_data.get("upload_id", ""),
            "title": story_data.get("title", ""),
            "content": story_data.get("content", ""),
            "audioUrl": story_data.get("audio_url"),
            "status": story_data.get("status", "draft").upper(),
            "views": story_data.get("views", 0),
            "createdAt": story_data.get("created_at", ""),
            "updatedAt": story_data.get("updated_at", ""),
            "contentType": content_type,
            "visibility": visibility,
        }
        
        return transformed
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create story: {str(e)}"
        )


@router.post("/{story_id}/generate-audio", response_model=None)
async def generate_audio(story_id: str, request: GenerateAudioRequest):
    """Generate audio for a story"""
    try:
        from ...utils.config import get_settings
        from supabase import create_client, Client
        
        settings = get_settings()
        supabase: Client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key
        )
        
        # Get the story first
        story_response = supabase.table("stories").select("*").eq("id", story_id).execute()
        
        if not story_response.data or len(story_response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Story with id {story_id} not found"
            )
        
        story = story_response.data[0]
        
        # Check if TTS service is enabled
        if not settings.tts_service_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="TTS service is disabled"
            )
        
        # Generate audio using TTS service
        from ...services.tts import tts_service
        
        audio_result = await tts_service.synthesize(story.get("content", ""))
        
        # Update story with audio URL
        # In a real implementation, you'd upload the audio and get a URL
        audio_url = audio_result.get("audio_url", "")
        
        if audio_url:
            supabase.table("stories").update({
                "audio_url": audio_url
            }).eq("id", story_id).execute()
        
        return {"audioUrl": audio_url}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate audio: {str(e)}"
        )
