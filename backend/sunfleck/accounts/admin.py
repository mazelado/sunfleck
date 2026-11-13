"""Django admin pages for accounts (at /admin, for the first Admin account)."""

from typing import Any

from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm
from django.utils.translation import gettext_lazy as _

from sunfleck.accounts.models import Household, Invitation, Membership, User


class UserCreationForm(AdminUserCreationForm[User]):
    class Meta(AdminUserCreationForm.Meta):
        model = User
        fields = ("email",)


class UserEditForm(UserChangeForm[User]):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(DjangoUserAdmin[User]):
    form = UserEditForm
    add_form = UserCreationForm
    list_display = ("email", "display_name", "is_staff", "is_active", "date_joined")
    search_fields = ("email", "display_name")
    ordering = ("email",)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Profile"), {"fields": ("display_name", "locale", "unit_system")}),
        (
            _("Permissions"),
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),)


class MembershipForm(forms.ModelForm[Membership]):
    class Meta:
        model = Membership
        fields = ("user", "household", "role")

    def clean(self) -> dict[str, Any]:
        """Refuse to put someone in a second household: each person has one for now, and with
        two, which one they'd see wouldn't be defined."""
        cleaned = super().clean() or {}
        user = cleaned.get("user")
        if isinstance(user, User):
            others = Membership.objects.filter(user=user).exclude(pk=self.instance.pk)
            if others.exists():
                raise forms.ValidationError(
                    _("%(person)s already belongs to a household. Each person can belong to one."),
                    code="one_household",
                    params={"person": user.email},
                )
        return cleaned


class MembershipInline(admin.TabularInline[Membership, Household]):
    model = Membership
    form = MembershipForm
    extra = 0
    autocomplete_fields = ("user",)


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin[Household]):
    list_display = ("name", "created_at")
    inlines = (MembershipInline,)


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin[Invitation]):
    list_display = ("email", "household", "role", "created_at", "expires_at", "accepted_at")
    list_filter = ("role", "household")
    readonly_fields = ("token_hash",)
