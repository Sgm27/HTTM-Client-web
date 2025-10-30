from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.get("/progress/{file_id}", response_model=None)
async def get_ocr_progress(file_id: str):
    """Get OCR progress for a file"""
    try:
        from ...utils.config import get_settings
        from supabase import create_client, Client
        
        settings = get_settings()
        supabase: Client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key
        )
        
        # Query the files table for OCR progress
        response = supabase.table("files").select("*").eq("id", file_id).execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File with id {file_id} not found"
            )
        
        file_data = response.data[0]
        
        # Return progress information (transformed to match frontend schema)
        return {
            "progress": file_data.get("progress", 0),
            "text": file_data.get("content"),  # Map 'content' to 'text' for frontend
        }
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch OCR progress: {str(e)}"
        )
