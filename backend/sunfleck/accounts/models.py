"""Account models."""

from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """A person who can sign in to Sunfleck.

    Django strongly recommends a custom user model from the very first migration, because
    switching later is very difficult. Fields such as email sign-in, locale, and unit
    preferences are added in milestone M1.
    """
