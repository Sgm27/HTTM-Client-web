import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
from uuid import uuid4

router = APIRouter(prefix="/stories", tags=["stories"])


class CreateStoryRequest(BaseModel):
    uploadId: str


class GenerateAudioRequest(BaseModel):
    speed: Optional[float] = 1.0
    voice: Optional[str] = None


class CreateCommentRequest(BaseModel):
    userId: str = Field(..., description="ID của người dùng gửi bình luận")
    content: str = Field(..., min_length=1, description="Nội dung bình luận")


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
        
        # Convert AnyHttpUrl to string to avoid regex issues
        supabase_url_str = str(settings.supabase_url) if hasattr(settings.supabase_url, '__str__') else settings.supabase_url
        supabase: Client = create_client(
            supabase_url_str,
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

        # Increment story view count and record the view event
        try:
            current_views = story_data.get("view_count") or 0
            updated_views = current_views + 1
            supabase.table("stories").update({"view_count": updated_views}).eq("id", story_id).execute()
            story_data["view_count"] = updated_views
        except Exception as exc:  # pragma: no cover - logging only
            logging.getLogger(__name__).warning("Failed to update story view count: %s", exc)

        try:
            supabase.table("story_views").insert({"story_id": story_id}).execute()
        except Exception as exc:  # pragma: no cover - logging only
            logging.getLogger(__name__).warning("Failed to record story view: %s", exc)

        # Fetch author profile information
        author_profile = None
        author_id = story_data.get("author_id")
        if author_id:
            profile_response = supabase.table("profiles").select("id, full_name, avatar_url").eq("id", author_id).execute()
            if profile_response.data:
                profile = profile_response.data[0]
                author_profile = {
                    "id": profile.get("id"),
                    "fullName": profile.get("full_name"),
                    "avatarUrl": profile.get("avatar_url"),
                }

        # Fetch comments and join profile data manually because there is no FK between story_comments and profiles
        comments_response = supabase.table("story_comments").select(
            "id, content, created_at, story_id, user_id"
        ).eq("story_id", story_id).order("created_at", desc=True).execute()

        comments_data = comments_response.data or []
        user_ids = {comment.get("user_id") for comment in comments_data if comment.get("user_id")}
        profiles_map = {}

        if user_ids:
            profile_response = (
                supabase.table("profiles")
                .select("id, full_name, avatar_url")
                .in_("id", list(user_ids))
                .execute()
            )
            for profile_row in profile_response.data or []:
                profile_id = profile_row.get("id")
                profiles_map[profile_id] = {
                    "id": profile_id,
                    "fullName": profile_row.get("full_name"),
                    "avatarUrl": profile_row.get("avatar_url"),
                }

        comments = []
        for comment in comments_data:
            author_profile = profiles_map.get(comment.get("user_id"))
            comments.append({
                "id": comment.get("id"),
                "storyId": comment.get("story_id"),
                "userId": comment.get("user_id"),
                "text": comment.get("content", ""),
                "createdAt": comment.get("created_at"),
                "author": author_profile
                or {
                    "id": comment.get("user_id"),
                    "fullName": None,
                    "avatarUrl": None,
                },
            })

        comment_count = len(comments)

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
            "uploadId": story_data.get("upload_id") or "",
            "title": story_data.get("title") or "",
            "description": story_data.get("description"),
            "content": story_data.get("content") or "",
            "audioUrl": story_data.get("audio_url"),
            "audioStatus": story_data.get("audio_status"),
            "status": (story_data.get("status") or "draft").upper(),
            "views": story_data.get("view_count") or 0,
            "createdAt": story_data.get("created_at") or "",
            "updatedAt": story_data.get("updated_at") or "",
            "contentType": content_type,
            "visibility": visibility,
            "authorId": story_data.get("author_id"),
            "coverImageUrl": story_data.get("cover_image_url"),
            "thumbnailUrl": story_data.get("thumbnail_url"),
            "author": author_profile,
            "commentCount": comment_count,
            "comments": comments,
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
        # Convert AnyHttpUrl to string to avoid regex issues
        supabase_url_str = str(settings.supabase_url) if hasattr(settings.supabase_url, '__str__') else settings.supabase_url
        supabase: Client = create_client(
            supabase_url_str,
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
        
        extracted_text = upload_data.get("extracted_text", "") or ""
        has_content = bool(extracted_text.strip())
        # Always start with 'PENDING' (uppercase) to match database constraint
        initial_audio_status = "PENDING"

        # Get thumbnail URL if thumbnail_file_id exists
        thumbnail_url = None
        thumbnail_file_id = upload_data.get("thumbnail_file_id")
        if thumbnail_file_id:
            from urllib.parse import quote
            
            # Helper function to build public URL
            def _build_public_url(base_url: str, bucket: str, path: str) -> str:
                normalized = path.lstrip("/")
                encoded = quote(normalized, safe="/")
                return f"{base_url.rstrip('/')}/storage/v1/object/public/{bucket}/{encoded}"
            
            # Helper function to extract public URL
            def _extract_public_url(result, fallback: str) -> str:
                if isinstance(result, dict):
                    data = result.get("data")
                    if isinstance(data, dict):
                        url = data.get("publicUrl") or data.get("publicURL")
                        if url:
                            return url
                    url = result.get("publicUrl") or result.get("publicURL")
                    if url:
                        return url
                return fallback
            
            thumbnail_public = supabase.storage.from_("uploads").get_public_url(thumbnail_file_id)
            thumbnail_url = _extract_public_url(
                thumbnail_public,
                _build_public_url(supabase_url_str, "uploads", thumbnail_file_id),
            )

        # Create story from upload data
        story_insert = {
            "upload_id": request.uploadId,
            "title": upload_data.get("title", ""),
            "description": upload_data.get("description"),
            "content": upload_data.get("extracted_text", ""),
            "author_id": upload_data.get("user_id"),
            "content_type": upload_data.get("content_type", "TEXT"),
            "is_public": is_public,
            "status": "PUBLISHED",  # Mark as published when creating story
            "audio_status": initial_audio_status,
            "thumbnail_url": thumbnail_url,  # Add thumbnail URL to story
        }

        response = supabase.table("stories").insert(story_insert).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create story"
            )
        
        story_data = response.data[0]

        # Generate TTS audio automatically when possible
        story_content = story_data.get("content", "") or ""
        if settings.tts_service_enabled and story_content.strip():
            from ...services.tts import tts_service

            supabase.table("stories").update({"audio_status": "PROCESSING"}).eq("id", story_data.get("id")).execute()
            try:
                audio_bytes, _ = await tts_service.synthesize_bytes(story_content)
                audio_filename = f"{story_data.get('author_id', 'public')}/{uuid4()}.wav"
                supabase.storage.from_("audio-files").upload(
                    audio_filename,
                    audio_bytes,
                    {"content-type": "audio/wav"},
                )
                audio_url = supabase.storage.from_("audio-files").get_public_url(audio_filename)
                supabase.table("stories").update({
                    "audio_url": audio_url,
                    "audio_status": "COMPLETED",
                }).eq("id", story_data.get("id")).execute()
                story_data["audio_url"] = audio_url
                story_data["audio_status"] = "COMPLETED"
            except Exception:
                supabase.table("stories").update({"audio_status": "FAILED"}).eq("id", story_data.get("id")).execute()
                story_data["audio_status"] = "FAILED"
        
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

        author_profile = None
        author_id = story_data.get("author_id")
        if author_id:
            profile_response = supabase.table("profiles").select("id, full_name, avatar_url").eq("id", author_id).execute()
            if profile_response.data:
                profile = profile_response.data[0]
                author_profile = {
                    "id": profile.get("id"),
                    "fullName": profile.get("full_name"),
                    "avatarUrl": profile.get("avatar_url"),
                }

        # Transform to camelCase
        transformed = {
            "id": story_data.get("id"),
            "uploadId": story_data.get("upload_id", ""),
            "title": story_data.get("title", ""),
            "description": story_data.get("description"),
            "content": story_data.get("content", ""),
            "audioUrl": story_data.get("audio_url"),
            "audioStatus": story_data.get("audio_status"),
            "status": story_data.get("status", "draft").upper(),
            "views": story_data.get("view_count") or 0,
            "createdAt": story_data.get("created_at", ""),
            "updatedAt": story_data.get("updated_at", ""),
            "contentType": content_type,
            "visibility": visibility,
            "authorId": story_data.get("author_id"),
            "coverImageUrl": story_data.get("cover_image_url"),
            "thumbnailUrl": story_data.get("thumbnail_url"),
            "author": author_profile,
            "commentCount": 0,
            "comments": [],
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
        # Convert AnyHttpUrl to string to avoid regex issues
        supabase_url_str = str(settings.supabase_url) if hasattr(settings.supabase_url, '__str__') else settings.supabase_url
        supabase: Client = create_client(
            supabase_url_str,
            settings.supabase_service_role_key
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
        
        story_content = story.get("content", "") or ""
        if not story_content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Story content is empty",
            )

        supabase.table("stories").update({"audio_status": "PROCESSING"}).eq("id", story_id).execute()

        from ...services.tts import tts_service

        audio_url = story.get("audio_url") or ""

        try:
            audio_bytes, _ = await tts_service.synthesize_bytes(story_content)
            audio_filename = f"{story.get('author_id', 'public')}/{uuid4()}.wav"
            supabase.storage.from_("audio-files").upload(
                audio_filename,
                audio_bytes,
                {"content-type": "audio/wav"},
            )
            audio_url = supabase.storage.from_("audio-files").get_public_url(audio_filename)
            supabase.table("stories").update({
                "audio_url": audio_url,
                "audio_status": "COMPLETED",
            }).eq("id", story_id).execute()
        except Exception as exc:
            supabase.table("stories").update({"audio_status": "FAILED"}).eq("id", story_id).execute()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate audio: {str(exc)}",
            ) from exc

        return {"audioUrl": audio_url}

    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate audio: {str(e)}"
        )


@router.post("/{story_id}/comments", response_model=None)
async def create_comment(story_id: str, request: CreateCommentRequest):
    """Create a new comment for a story"""
    content = request.content.strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comment content cannot be empty",
        )

    try:
        from ...utils.config import get_settings
        from supabase import create_client, Client

        settings = get_settings()
        # Convert AnyHttpUrl to string to avoid regex issues
        supabase_url_str = str(settings.supabase_url) if hasattr(settings.supabase_url, '__str__') else settings.supabase_url
        supabase: Client = create_client(
            supabase_url_str,
            settings.supabase_service_role_key,
        )

        # Ensure story exists
        story_response = supabase.table("stories").select("id").eq("id", story_id).execute()
        if not story_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Story with id {story_id} not found",
            )

        insert_payload = {
            "story_id": story_id,
            "user_id": request.userId,
            "content": content,
        }

        insert_response = supabase.table("story_comments").insert(insert_payload).execute()
        if not insert_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create comment",
            )

        comment_data = insert_response.data[0]

        profile = None
        profile_response = supabase.table("profiles").select("id, full_name, avatar_url").eq("id", request.userId).execute()
        if profile_response.data:
            profile_raw = profile_response.data[0]
            profile = {
                "id": profile_raw.get("id"),
                "fullName": profile_raw.get("full_name"),
                "avatarUrl": profile_raw.get("avatar_url"),
            }

        count_response = supabase.table("story_comments").select("id", count="exact").eq("story_id", story_id).execute()
        comment_count = count_response.count if count_response and getattr(count_response, "count", None) is not None else None

        return {
            "id": comment_data.get("id"),
            "storyId": comment_data.get("story_id"),
            "userId": comment_data.get("user_id"),
            "text": comment_data.get("content", ""),
            "createdAt": comment_data.get("created_at"),
            "author": profile,
            "commentCount": comment_count,
        }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create comment: {str(e)}"
        )
