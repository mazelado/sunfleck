from datetime import UTC, date, datetime

from factory.declarations import SubFactory
from factory.django import DjangoModelFactory

from sunfleck.care.tests.factories import CareEventFactory
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.sensors import kinds
from sunfleck.sensors.models import CareReading, PlantSensor, SensorDay


class PlantSensorFactory(DjangoModelFactory[PlantSensor]):
    class Meta:
        model = PlantSensor

    plant = SubFactory(PlantFactory)
    kind = kinds.SOIL_MOISTURE
    plugin_id = "homeassistant"
    sensor_id = "sensor.monstera_soil_moisture"
    name = "Monstera soil moisture"
    value = 42.0
    measured_at = datetime(2026, 5, 1, 8, 45, tzinfo=UTC)


class SensorDayFactory(DjangoModelFactory[SensorDay]):
    class Meta:
        model = SensorDay

    sensor = SubFactory(PlantSensorFactory)
    date = date(2026, 5, 1)
    low = 38.0
    high = 51.0
    mean = 44.5
    last = 42.0
    count = 96


class CareReadingFactory(DjangoModelFactory[CareReading]):
    class Meta:
        model = CareReading

    event = SubFactory(CareEventFactory)
    kind = kinds.SOIL_MOISTURE
    value = 42.0
    measured_at = datetime(2026, 5, 1, 8, 45, tzinfo=UTC)
