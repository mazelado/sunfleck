"""Customizations of django-allauth's behavior."""

from allauth.account.adapter import DefaultAccountAdapter
from django.http import HttpRequest


class AccountAdapter(DefaultAccountAdapter):  # type: ignore[misc]  # allauth is untyped
    def is_open_for_signup(self, request: HttpRequest) -> bool:
        """Nobody can sign up on their own: Admins invite people instead."""
        return False
