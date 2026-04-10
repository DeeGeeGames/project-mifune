extends Node
class_name HealthComponent
# Reusable component that owns HP state and emits signals on damage/death.
# Parent initializes hp_max, connects to died/damaged signals for entity-specific behavior.

signal damaged(new_hp: int)
signal died()

var hp: int = 0
var hp_max: int = 0

func initialize(max_value: int) -> void:
	hp_max = max_value
	hp = max_value

func take_damage(amount: int) -> void:
	hp -= amount
	if hp <= 0:
		hp = 0
		died.emit()
		return
	damaged.emit(hp)

func get_ratio() -> float:
	return float(hp) / float(hp_max) if hp_max > 0 else 1.0
