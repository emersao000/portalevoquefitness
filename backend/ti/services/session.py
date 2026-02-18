import secrets
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ti.models import Session as SessionModel
from core.utils import now_brazil_naive


class SessionService:
    """Service for managing user sessions in database"""

    @staticmethod
    def create_session(
        db: Session,
        user_id: int,
        access_token: str,
        expires_in: int = 86400,  # 24 hours default
        refresh_token: str | None = None,
        refresh_expires_in: int | None = None,  # 30 days default
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> SessionModel:
        """
        Create a new session in the database

        Args:
            db: Database session
            user_id: User ID
            access_token: The JWT token
            expires_in: Token expiration in seconds (default 24 hours)
            refresh_token: Optional refresh token
            refresh_expires_in: Refresh token expiration in seconds (default 30 days)
            ip_address: Client IP address
            user_agent: Client user agent
        """
        now = datetime.utcnow()
        access_token_expires_at = now + timedelta(seconds=expires_in)
        refresh_token_expires_at = None

        if refresh_expires_in:
            refresh_token_expires_at = now + timedelta(seconds=refresh_expires_in)
        elif refresh_token:
            # Default 30 days if not specified
            refresh_token_expires_at = now + timedelta(days=30)

        # Generate session token (this is the token we return to client)
        session_token = secrets.token_urlsafe(32)

        session = SessionModel(
            user_id=user_id,
            session_token=session_token,
            refresh_token=refresh_token,
            access_token_expires_at=access_token_expires_at,
            refresh_token_expires_at=refresh_token_expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
            is_active=True,
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        return session

    @staticmethod
    def get_session(db: Session, session_token: str) -> SessionModel | None:
        """Get a session by token"""
        return (
            db.query(SessionModel)
            .filter(
                SessionModel.session_token == session_token,
                SessionModel.is_active == True,
            )
            .first()
        )

    @staticmethod
    def validate_session(db: Session, session_token: str) -> bool:
        """Validate if a session is active and not expired"""
        session = SessionService.get_session(db, session_token)

        if not session:
            return False

        if session.is_expired():
            session.is_active = False
            db.commit()
            return False

        return True

    @staticmethod
    def revoke_session(db: Session, session_token: str) -> bool:
        """Revoke a session"""
        session = SessionService.get_session(db, session_token)

        if not session:
            return False

        session.revoke()
        db.commit()
        return True

    @staticmethod
    def revoke_all_user_sessions(db: Session, user_id: int) -> int:
        """Revoke all sessions for a user"""
        sessions = db.query(SessionModel).filter(
            SessionModel.user_id == user_id,
            SessionModel.is_active == True,
        )
        count = sessions.count()

        for session in sessions:
            session.revoke()

        db.commit()
        return count

    @staticmethod
    def cleanup_expired_sessions(db: Session) -> int:
        """Clean up expired sessions from database"""
        now = datetime.utcnow()
        sessions = db.query(SessionModel).filter(
            SessionModel.access_token_expires_at < now
        )
        count = sessions.count()

        sessions.delete()
        db.commit()

        return count

    @staticmethod
    def get_user_sessions(db: Session, user_id: int) -> list[SessionModel]:
        """Get all active sessions for a user"""
        return (
            db.query(SessionModel)
            .filter(
                SessionModel.user_id == user_id,
                SessionModel.is_active == True,
            )
            .all()
        )
