"""Account models: users, households, memberships (roles), and invitations."""

from datetime import datetime
from typing import Any, ClassVar

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


def normalize_email(email: str) -> str:
    """Return `email` trimmed and lowercased, so each address maps to exactly one account."""
    return email.strip().lower()


class UserManager(BaseUserManager["User"]):
    use_in_migrations = True

    def create_user(self, email: str, password: str | None = None, **extra: Any) -> "User":
        if not email:
            raise ValueError("Users must have an email address.")
        user = self.model(email=normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra: Any) -> "User":
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)


class UnitSystem(models.TextChoices):
    METRIC = "metric", _("Metric")
    IMPERIAL = "imperial", _("Imperial")


class User(AbstractBaseUser, PermissionsMixin):
    """A person who can sign in to Sunfleck. People sign in with their email address."""

    email = models.EmailField(_("email address"), unique=True)
    display_name = models.CharField(_("display name"), max_length=150, blank=True)
    locale = models.CharField(_("language"), max_length=16, default="en")
    unit_system = models.CharField(
        _("units"), max_length=16, choices=UnitSystem.choices, default=UnitSystem.METRIC
    )
    is_active = models.BooleanField(_("active"), default=True)
    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Whether the user can sign in to the Django admin site."),
    )
    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)

    objects: ClassVar[UserManager] = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")

    def __str__(self) -> str:
        return self.email

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.email = normalize_email(self.email)
        super().save(*args, **kwargs)

    def get_full_name(self) -> str:
        return self.display_name or self.email

    def get_short_name(self) -> str:
        return self.display_name or self.email


class Household(models.Model):
    """A group of people who share one plant collection. Owns all plant data."""

    name = models.CharField(_("name"), max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("household")
        verbose_name_plural = _("households")

    def __str__(self) -> str:
        return self.name


class Role(models.TextChoices):
    """What a member may do in their household, from least to most access."""

    VIEWER = "viewer", _("Viewer")
    GARDENER = "gardener", _("Gardener")
    ADMIN = "admin", _("Admin")

    @property
    def rank(self) -> int:
        return list(Role).index(self)

    def includes(self, other: "Role") -> bool:
        """Return whether this role has at least the access of `other`."""
        return self.rank >= other.rank


class Membership(models.Model):
    """Links a user to a household with a role."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(_("role"), max_length=16, choices=Role.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("membership")
        verbose_name_plural = _("memberships")
        constraints = [
            models.UniqueConstraint(fields=["user", "household"], name="unique_membership"),
        ]

    def __str__(self) -> str:
        return f"{self.user} in {self.household} ({self.role})"


class Invitation(models.Model):
    """An invitation for someone to join a household.

    Only a hash of the invitation token is stored, so a leaked database doesn't reveal working
    invitation links.
    """

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField(_("email address"))
    role = models.CharField(_("role"), max_length=16, choices=Role.choices)
    token_hash = models.CharField(max_length=64, unique=True)
    invited_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="sent_invitations"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = _("invitation")
        verbose_name_plural = _("invitations")

    def __str__(self) -> str:
        return f"Invitation for {self.email} to {self.household}"

    def is_pending(self, now: datetime) -> bool:
        return self.accepted_at is None and self.revoked_at is None and self.expires_at > now
