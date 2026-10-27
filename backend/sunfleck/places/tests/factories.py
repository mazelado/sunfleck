from factory.declarations import SubFactory
from factory.django import DjangoModelFactory

from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.places.models import LightSource, Location, LocationKind, Site


class SiteFactory(DjangoModelFactory[Site]):
    class Meta:
        model = Site

    household = SubFactory(HouseholdFactory)
    name = "Home"
    latitude = 52.37
    longitude = 4.89
    timezone = "Europe/Amsterdam"


class LocationFactory(DjangoModelFactory[Location]):
    class Meta:
        model = Location

    site = SubFactory(SiteFactory)
    name = "Living room"
    kind = LocationKind.INDOOR


class WindowFactory(DjangoModelFactory[LightSource]):
    class Meta:
        model = LightSource

    location = SubFactory(LocationFactory)
    kind = "window"
    direction = "S"
    distance_cm = 100
