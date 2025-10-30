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
        
        # Determine status based on file type and OCR service
        # For text files (.txt), we can read content directly without OCR
        file_extension = contentFile.filename.lower().split('.')[-1] if contentFile.filename else ''
        text_extensions = ['txt', 'text']
        image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'pdf']
        
        initial_status = "DRAFT"
        initial_progress = 0
        extracted_content = None
        
        # If it's a plain text file, read content directly and mark as READY
        if file_extension in text_extensions:
            try:
                # Decode text content
                text_content = content_data.decode('utf-8')
                extracted_content = text_content
                initial_status = "READY"
                initial_progress = 100
            except Exception as e:
                print(f"Error reading text file: {e}")
                initial_status = "FAILED"
                
        # If it's an image and OCR is enabled, mark for OCR processing
        elif file_extension in image_extensions and settings.ocr_service_enabled:
            initial_status = "OCR_IN_PROGRESS"
            initial_progress = 0
            # TODO: Trigger OCR job here
        # Otherwise keep as DRAFT
        else:
            initial_status = "DRAFT"
            initial_progress = 0
        
        # Create upload record in database
        upload_data = {
            "user_id": userId,
            "content_type": contentType.upper(),  # Ensure uppercase to match enum
            "visibility": visibility.upper(),  # Ensure uppercase to match enum
            "title": title,
            "description": description,
            "content_file_id": content_filename,  # Store file path/ID
            "thumbnail_file_id": thumbnail_filename,  # Store file path/ID
            "status": initial_status,
            "progress": initial_progress,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        # Add extracted content if available (using extracted_text column)
        if extracted_content:
            upload_data["extracted_text"] = extracted_content
        
        response = supabase.table("uploads").insert(upload_data).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create upload"
            )
        
        # Transform snake_case to camelCase for frontend
        upload_record = response.data[0]
        transformed = {
            "id": upload_record.get("id"),
            "userId": upload_record.get("user_id"),
            "contentType": upload_record.get("content_type"),
            "visibility": upload_record.get("visibility"),
            "title": upload_record.get("title"),
            "description": upload_record.get("description"),
            "contentFileId": upload_record.get("content_file_id"),
            "thumbnailFileId": upload_record.get("thumbnail_file_id"),
            "status": upload_record.get("status"),
            "progress": upload_record.get("progress"),
            "content": upload_record.get("extracted_text"),  # Map extracted_text to content
            "errorReason": upload_record.get("error_reason"),
            "createdAt": upload_record.get("created_at"),
            "updatedAt": upload_record.get("updated_at"),
        }
        
        return {"upload": transformed}
        
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
        
        # Transform snake_case to camelCase for frontend
        upload_record = response.data[0]
        transformed = {
            "id": upload_record.get("id"),
            "userId": upload_record.get("user_id"),
            "contentType": upload_record.get("content_type"),
            "visibility": upload_record.get("visibility"),
            "title": upload_record.get("title"),
            "description": upload_record.get("description"),
            "contentFileId": upload_record.get("content_file_id"),
            "thumbnailFileId": upload_record.get("thumbnail_file_id"),
            "status": upload_record.get("status"),
            "progress": upload_record.get("progress"),
            "content": upload_record.get("extracted_text"),  # Map extracted_text to content
            "errorReason": upload_record.get("error_reason"),
            "createdAt": upload_record.get("created_at"),
            "updatedAt": upload_record.get("updated_at"),
        }
        
        return transformed
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch upload: {str(e)}"
        )
