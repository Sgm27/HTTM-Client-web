from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from typing import Optional

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("", response_model=None)
async def create_upload(
    userId: str = Form(...),
    contentType: str = Form(...),
    visibility: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    contentFile: UploadFile = File(...),
    thumbnailFile: Optional[UploadFile] = File(None),
):
    """Create a new upload"""
    try:
        from ...utils.config import get_settings
        from supabase import create_client, Client
        import uuid
        from datetime import datetime
        
        settings = get_settings()
        supabase: Client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key  # Use service role key for server-side operations
        )
        
        # Generate unique filenames with user folder
        content_filename = f"{userId}/{uuid.uuid4()}_{contentFile.filename}"
        thumbnail_filename = f"{userId}/{uuid.uuid4()}_{thumbnailFile.filename}" if thumbnailFile else None
        
        # Upload content file to Supabase storage
        content_data = await contentFile.read()
        content_upload = supabase.storage.from_("uploads").upload(
            content_filename,
            content_data,
            {"content-type": contentFile.content_type or "application/octet-stream"}
        )
        
        # Get public URL for content file
        content_url = supabase.storage.from_("uploads").get_public_url(content_filename)
        
        # Upload thumbnail if provided
        thumbnail_url = None
        if thumbnailFile:
            thumbnail_data = await thumbnailFile.read()
            thumbnail_upload = supabase.storage.from_("uploads").upload(
                thumbnail_filename,
                thumbnail_data,
                {"content-type": thumbnailFile.content_type or "image/jpeg"}
            )
            thumbnail_url = supabase.storage.from_("uploads").get_public_url(thumbnail_filename)
        
        # Create upload record in database
        upload_data = {
            "user_id": userId,
            "content_type": contentType,
            "visibility": visibility,
            "title": title,
            "description": description,
            "content_file_id": content_filename,  # Store file path/ID
            "thumbnail_file_id": thumbnail_filename,  # Store file path/ID
            "status": "pending",
            "progress": 0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        response = supabase.table("uploads").insert(upload_data).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create upload"
            )
        
        return {"upload": response.data[0]}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create upload: {str(e)}"
        )


@router.get("/{upload_id}", response_model=None)
async def get_upload(upload_id: str):
    """Get upload by ID"""
    try:
        from ...utils.config import get_settings
        from supabase import create_client, Client
        
        settings = get_settings()
        supabase: Client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key
        )
        
        response = supabase.table("uploads").select("*").eq("id", upload_id).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Upload with id {upload_id} not found"
            )
        
        return response.data[0]
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch upload: {str(e)}"
        )
