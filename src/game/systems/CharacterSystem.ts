import * as Phaser from 'phaser'
import { PlayerState } from '@/game/types'
import { RoadSystem } from './RoadSystem'
import { isTypingInFormElement } from '@/game/utils/keyboard'

const FRAME_INTERVAL = 140
const CHAR_SIZE = 256
const BASE_SPEED = 250
const ON_ROAD_MULTIPLIER = 1.15
const OFF_ROAD_MULTIPLIER = 0.90

export class CharacterSystem {
  private scene: Phaser.Scene
  private state: PlayerState = { x: 400, y: 300, speed: BASE_SPEED }
  sprite!: Phaser.GameObjects.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key }
  private joystickInput: { dx: number; dy: number } = { dx: 0, dy: 0 }
  private roadSystem?: RoadSystem
  private direction: 'left' | 'right' = 'right'
  private animFrame = 0
  private animTimer = 0
  private _onRoad = false
  private _speedMultiplier = ON_ROAD_MULTIPLIER
  private _isMoving = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  init(): void {
    if (this.scene.input.keyboard) {
      this.cursors = this.scene.input.keyboard.createCursorKeys()

      this.wasd = {
        W: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      }
    }
  }

  create(x: number, y: number): void {
    this.state.x = x
    this.state.y = y
    this.sprite = this.scene.add.sprite(x, y, 'char_0')
    this.sprite.setDisplaySize(CHAR_SIZE, CHAR_SIZE)
    this.sprite.setDepth(5)
    this.sprite.setOrigin(0.5, 0.5)
  }

  setRoadSystem(rs: RoadSystem): void {
    this.roadSystem = rs
  }

  setJoystickInput(dx: number, dy: number): void {
    this.joystickInput = { dx, dy }
  }

  setPosition(x: number, y: number): void {
    this.state.x = x
    this.state.y = y
  }

  getState(): PlayerState {
    return { ...this.state }
  }

  get onRoad(): boolean {
    return this._onRoad
  }

  get speedMultiplier(): number {
    return this._speedMultiplier
  }

  get isMoving(): boolean {
    return this._isMoving
  }

  update(delta: number, bounds?: { width: number; height: number }): void {
    if (!this.sprite) return
    const dt = delta / 1000
    let dx = 0
    let dy = 0

    if (isTypingInFormElement()) {
      this.sprite.setPosition(this.state.x, this.state.y)
      this.sprite.setTexture(`char_${this.animFrame}`)
      return
    }

    if (this.cursors?.left.isDown || this.wasd?.A.isDown || this.joystickInput.dx < -0.1) {
      dx = -1
      this.direction = 'left'
    }
    if (this.cursors?.right.isDown || this.wasd?.D.isDown || this.joystickInput.dx > 0.1) {
      dx = 1
      this.direction = 'right'
    }
    if (this.cursors?.up.isDown || this.wasd?.W.isDown || this.joystickInput.dy < -0.1) {
      dy = -1
    }
    if (this.cursors?.down.isDown || this.wasd?.S.isDown || this.joystickInput.dy > 0.1) {
      dy = 1
    }

    if (this.joystickInput.dx !== 0 || this.joystickInput.dy !== 0) {
      const mag = Math.sqrt(
        this.joystickInput.dx * this.joystickInput.dx +
        this.joystickInput.dy * this.joystickInput.dy
      )
      if (mag > 0) {
        dx = this.joystickInput.dx / mag
        dy = this.joystickInput.dy / mag
        if (dx < -0.1) this.direction = 'left'
        else if (dx > 0.1) this.direction = 'right'
      }
    }

    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy)
      dx /= len
      dy /= len
    }

    const clampX = (v: number) => bounds ? Math.max(5, Math.min(bounds.width - 5, v)) : v
    const clampY = (v: number) => bounds ? Math.max(5, Math.min(bounds.height - 5, v)) : v

    const newX = this.state.x + dx * BASE_SPEED * dt
    const newY = this.state.y + dy * BASE_SPEED * dt

    this._onRoad = this.roadSystem ? this.roadSystem.isWalkable(newX, newY) : true
    this._speedMultiplier = this._onRoad ? ON_ROAD_MULTIPLIER : OFF_ROAD_MULTIPLIER

    this.state.x = clampX(newX)
    this.state.y = clampY(newY)

    const moving = dx !== 0 || dy !== 0
    this._isMoving = moving

    if (moving) {
      this.animTimer += delta
      if (this.animTimer >= FRAME_INTERVAL) {
        this.animTimer -= FRAME_INTERVAL
        this.animFrame = (this.animFrame + 1) % 4
      }
    } else {
      this.animFrame = 0
      this.animTimer = 0
    }

    this.sprite.setPosition(this.state.x, this.state.y)
    this.sprite.setFlipX(this.direction === 'left')
    this.sprite.setTexture(`char_${this.animFrame}`)
  }

  destroy(): void {
    if (this.sprite) this.sprite.destroy()
  }
}
