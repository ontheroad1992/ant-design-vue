import raf from 'raf';
import PropTypes from '../_util/vue-types';
import Menu from '../vc-menu';
import scrollIntoView from 'dom-scroll-into-view';
import { getSelectKeys, preventDefaultEvent } from './util';
import { cloneElement } from '../_util/vnode';
import BaseMixin from '../_util/BaseMixin';
import { getSlotOptions, getComponentFromProp, getListeners } from '../_util/props-util';
import KeyCode from '../_util/KeyCode';

// 默认偏移值
let defaultMenuOffset = 12;
let oldPosition = 0;

export default {
  name: 'DropdownMenu',
  mixins: [BaseMixin],
  props: {
    ariaId: PropTypes.string,
    defaultActiveFirstOption: PropTypes.bool,
    value: PropTypes.any,
    dropdownMenuStyle: PropTypes.object,
    multiple: PropTypes.bool,
    // onPopupFocus: PropTypes.func,
    // onPopupScroll: PropTypes.func,
    // onMenuDeSelect: PropTypes.func,
    // onMenuSelect: PropTypes.func,
    prefixCls: PropTypes.string,
    menuItems: PropTypes.any,
    inputValue: PropTypes.string,
    visible: PropTypes.bool,
    backfillValue: PropTypes.any,
    firstActiveValue: PropTypes.string,
    menuItemSelectedIcon: PropTypes.any,
  },
  data: () => ({
    menuStart: 0,
    menuOffset: defaultMenuOffset,
    menuOptionHeight: 32,
    wrapperMaxHeight: 264,
  }),
  watch: {
    visible(val) {
      if (!val) {
        this.lastVisible = val;
      } else {
        this.$nextTick(() => {
          this.scrollActiveItemToView();
        });
      }
    },
    inputValue(val) {
      if (val) {
        const menuContainer = this.$refs.menuContainer;
        if (menuContainer) menuContainer.scrollTop = 0;
      }
    },
  },

  created() {
    this.rafInstance = null;
    this.lastInputValue = this.$props.inputValue;
    this.lastVisible = false;
  },

  mounted() {
    this.$nextTick(() => {
      this.scrollActiveItemToView();
    });
    this.lastVisible = this.$props.visible;

    // Calculate the offset value during virtual scrolling
    const { maxHeight } = this.dropdownMenuStyle;
    this.wrapperMaxHeight = parseInt(maxHeight) || this.wrapperMaxHeight;
    this.menuOffset = defaultMenuOffset =
      Math.ceil(parseInt(this.wrapperMaxHeight) / this.menuOptionHeight) + 4;
  },
  updated() {
    const props = this.$props;
    // if (!this.prevVisible && props.visible) {
    //   this.$nextTick(() => {
    //     this.scrollActiveItemToView();
    //   });
    // }
    // Roughly calculate the height of ‘select-option’
    this.$nextTick(() => {
      const menuRef = this.$refs.menuRef;
      if (menuRef && menuRef.$el) {
        const option = menuRef.$el.querySelector("li[role='option']");
        if (option) {
          this.menuOptionHeight = option.clientHeight;
        }
      }
    });
    this.lastVisible = props.visible;
    this.lastInputValue = props.inputValue;
    this.prevVisible = this.visible;
  },
  beforeDestroy() {
    if (this.rafInstance) {
      raf.cancel(this.rafInstance);
    }
  },
  methods: {
    scrollActiveItemToView() {
      // scroll into view
      const itemComponent = this.firstActiveItem && this.firstActiveItem.$el;
      const props = this.$props;
      const { value, visible, firstActiveValue } = props;
      if (!itemComponent || !visible) {
        return;
      }
      const scrollIntoViewOpts = {
        onlyScrollIfNeeded: true,
      };
      if ((!value || value.length === 0) && firstActiveValue) {
        scrollIntoViewOpts.alignWithTop = true;
      }
      // Delay to scroll since current frame item position is not ready when pre view is by filter
      // https://github.com/ant-design/ant-design/issues/11268#issuecomment-406634462
      this.rafInstance = raf(() => {
        scrollIntoView(itemComponent, this.$refs.menuRef.$el, scrollIntoViewOpts);
      });
    },

    renderMenu() {
      const props = this.$props;
      const {
        menuItems,
        defaultActiveFirstOption,
        value,
        prefixCls,
        multiple,
        inputValue,
        firstActiveValue,
        dropdownMenuStyle,
        backfillValue,
        visible,
      } = props;
      const menuItemSelectedIcon = getComponentFromProp(this, 'menuItemSelectedIcon');
      const { menuDeselect, menuSelect, popupScroll } = getListeners(this);
      if (menuItems && menuItems.length) {
        const selectedKeys = getSelectKeys(menuItems, value);
        const menuProps = {
          props: {
            multiple,
            itemIcon: multiple ? menuItemSelectedIcon : null,
            selectedKeys,
            prefixCls: `${prefixCls}-menu`,
          },
          on: {},
          style: {
            ...dropdownMenuStyle,
            // Movement control for virtual scrolling
            overflowY: 'hidden',
            // transform: `translateY(${this.menuStart * this.menuOptionHeight}px)`,
            maxHeight: this.menuOffset * this.menuOptionHeight + 'px',
          },
          ref: 'menuRef',
          attrs: {
            role: 'listbox',
          },
        };
        if (popupScroll) {
          menuProps.on.scroll = popupScroll;
        }
        if (multiple) {
          menuProps.on.deselect = menuDeselect;
          menuProps.on.select = menuSelect;
        } else {
          menuProps.on.click = menuSelect;
        }
        const activeKeyProps = {};

        let defaultActiveFirst = defaultActiveFirstOption;
        let clonedMenuItems = menuItems;
        if (selectedKeys.length || firstActiveValue) {
          if (props.visible && !this.lastVisible) {
            activeKeyProps.activeKey = selectedKeys[0] || firstActiveValue;
          } else if (!visible) {
            // Do not trigger auto active since we already have selectedKeys
            if (selectedKeys[0]) {
              defaultActiveFirst = false;
            }
            activeKeyProps.activeKey = undefined;
          }
          let foundFirst = false;
          // set firstActiveItem via cloning menus
          // for scroll into view
          const clone = item => {
            if (
              (!foundFirst && selectedKeys.indexOf(item.key) !== -1) ||
              (!foundFirst && !selectedKeys.length && firstActiveValue.indexOf(item.key) !== -1)
            ) {
              foundFirst = true;
              return cloneElement(item, {
                directives: [
                  {
                    name: 'ant-ref',
                    value: ref => {
                      this.firstActiveItem = ref;
                    },
                  },
                ],
              });
            }
            return item;
          };

          clonedMenuItems = menuItems.map(item => {
            if (getSlotOptions(item).isMenuItemGroup) {
              const children = item.componentOptions.children.map(clone);
              return cloneElement(item, { children });
            }
            return clone(item);
          });
        } else {
          // Clear firstActiveItem when dropdown menu items was empty
          // Avoid `Unable to find node on an unmounted component`
          // https://github.com/ant-design/ant-design/issues/10774
          this.firstActiveItem = null;
        }

        // Control the displayed data
        clonedMenuItems = clonedMenuItems.slice(this.menuStart, this.menuStart + this.menuOffset);

        // clear activeKey when inputValue change
        const lastValue = value && value[value.length - 1];
        if (inputValue !== this.lastInputValue && (!lastValue || lastValue !== backfillValue)) {
          activeKeyProps.activeKey = '';
        }
        menuProps.props = {
          ...activeKeyProps,
          ...menuProps.props,
          defaultActiveFirst,
        };
        return <Menu {...menuProps}>{clonedMenuItems}</Menu>;
      }
      return null;
    },
    onVirtualScroller(event) {
      console.log('XXX');
      // 现在的位置
      const newPositionY = event.target.scrollTop;

      if (Math.abs(oldPosition - newPositionY) > this.menuOptionHeight) {
        // 根据滚轴的距离来计算截取数据的起点，由于 wrapper 向上偏移了 1 位， 相应的将起始位置也偏移
        let start = Math.floor(newPositionY / this.menuOptionHeight);
        // 控制 wrapper 的偏移，防止出现空白
        if (start > 0) {
          this.menuOffset = defaultMenuOffset + 1;
          start -= 1;
        } else {
          this.menuOffset = defaultMenuOffset;
          // start = 0;
        }
        this.menuStart = start;

        oldPosition = newPositionY;

        const menuRef = this.$refs.menuRef;
        menuRef.$el.style.transform = `translateY(${newPositionY - this.menuOptionHeight * 2}px)`;
      }

      const { popupScroll } = getListeners(this);
      popupScroll(event);
    },
    onKeyDown(event, item) {
      const keyCode = event.keyCode;

      const menuContainer = this.$refs.menuContainer;

      let scrollTop = menuContainer.scrollTop;

      let itemOffsetTop = item.$el.offsetParent.offsetParent;
      console.log('itemOffsetTop', itemOffsetTop);
      // // 去掉偏移的部分
      // if (this.menuStart === 0) {
      //   itemOffsetTop += this.menuOptionHeight;
      // }
      // console.log(itemOffsetTop, scrollTop);

      // if (keyCode === KeyCode.DOWN) {
      //   if (itemOffsetTop >= this.wrapperMaxHeight) {
      //     scrollTop += this.menuOptionHeight;
      //   }
      // }

      // if (keyCode === KeyCode.UP) {
      //   if (itemOffsetTop <= this.menuOptionHeight) {
      //     scrollTop -= this.menuOptionHeight;
      //   }
      // }

      // menuContainer.scrollTop = scrollTop;
    },
  },
  render() {
    const renderMenu = this.renderMenu();
    const { popupFocus } = getListeners(this);

    return renderMenu ? (
      <div
        style={{
          overflow: 'auto',
          transform: 'translateZ(0)',
          maxHeight: this.wrapperMaxHeight + 'px',
        }}
        id={this.$props.ariaId}
        tabIndex="-1"
        onFocus={popupFocus}
        onMousedown={preventDefaultEvent}
        onScroll={this.onVirtualScroller}
        ref="menuContainer"
      >
        <div
          style={{
            minHeight: this.menuItems.length * this.menuOptionHeight + 'px',
          }}
        >
          {renderMenu}
        </div>
      </div>
    ) : null;
  },
};
