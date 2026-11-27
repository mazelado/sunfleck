from datetime import date

import pytest
from django.db import IntegrityError, transaction

from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.sensors import kinds
from sunfleck.sensors.models import CareReading, PlantSensor, SensorDay
from sunfleck.sensors.tests.factories import (
    CareReadingFactory,
    PlantSensorFactory,
    SensorDayFactory,
)

pytestmark = pytest.mark.django_db


def test_a_plant_has_at_most_one_sensor_of_each_kind() -> None:
    sensor = PlantSensorFactory.create()
    PlantSensorFactory.create(plant=sensor.plant, kind=kinds.TEMPERATURE)

    with pytest.raises(IntegrityError), transaction.atomic():
        PlantSensorFactory.create(plant=sensor.plant, sensor_id="sensor.another")

    assert sensor.plant.sensors.count() == 2


def test_one_sensor_can_be_chosen_for_several_plants() -> None:
    first = PlantSensorFactory.create(kind=kinds.HUMIDITY, sensor_id="sensor.room_humidity")
    PlantSensorFactory.create(
        plant=PlantFactory.create(household=first.plant.household),
        kind=kinds.HUMIDITY,
        sensor_id="sensor.room_humidity",
    )

    assert PlantSensor.objects.filter(sensor_id="sensor.room_humidity").count() == 2


def test_a_sensor_has_one_summary_a_day() -> None:
    day = SensorDayFactory.create()
    SensorDayFactory.create(sensor=day.sensor, date=date(2026, 5, 2))

    with pytest.raises(IntegrityError), transaction.atomic():
        SensorDayFactory.create(sensor=day.sensor, date=day.date)

    assert list(day.sensor.days.values_list("date", flat=True)) == [
        date(2026, 5, 1),
        date(2026, 5, 2),
    ]


def test_care_keeps_one_reading_of_each_kind() -> None:
    reading = CareReadingFactory.create()

    with pytest.raises(IntegrityError), transaction.atomic():
        CareReadingFactory.create(event=reading.event, value=10.0)

    assert list(reading.event.readings.all()) == [reading]


def test_a_sensors_summaries_and_readings_go_with_its_plant() -> None:
    day = SensorDayFactory.create()
    plant = day.sensor.plant
    CareReadingFactory.create(event__plant=plant)

    plant.delete()

    assert not PlantSensor.objects.exists()
    assert not SensorDay.objects.exists()
    assert not CareReading.objects.exists()


def test_kinds_are_the_four_sensors_read_for_plants() -> None:
    assert kinds.KINDS == ("soil_moisture", "illuminance", "temperature", "humidity")
