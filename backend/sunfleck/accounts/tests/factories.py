from factory.declarations import Sequence, SubFactory
from factory.django import DjangoModelFactory, Password
from factory.faker import Faker

from sunfleck.accounts.models import Household, Membership, Role, User

DEFAULT_PASSWORD = "correct horse battery staple"


class UserFactory(DjangoModelFactory[User]):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = Sequence(lambda n: f"person{n}@example.com")
    display_name = Faker("first_name")
    password = Password(DEFAULT_PASSWORD)


class HouseholdFactory(DjangoModelFactory[Household]):
    class Meta:
        model = Household

    name = "Green House"


class MembershipFactory(DjangoModelFactory[Membership]):
    class Meta:
        model = Membership

    user = SubFactory(UserFactory)
    household = SubFactory(HouseholdFactory)
    role = Role.GARDENER
